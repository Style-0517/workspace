import {
  createMiniTickerStreamName,
  createKlineStreamName,
  findSubscription,
} from "../config/binanceStreams.js";
import { chartPanels } from "../data/chartPanels.js";
import { BinanceMarketDataClient } from "./binanceMarketDataClient.js";

export const DEFAULT_PANEL_SEED_LIMIT = 120;

export const PANEL_STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  STREAMING: "streaming",
  ERROR: "error",
  STOPPED: "stopped",
});

function resolveInterval(panel) {
  return panel.interval ?? panel.timeframe;
}

function cloneCandle(candle) {
  return { ...candle };
}

function cloneError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name ?? "Error",
    message: error.message ?? String(error),
  };
}

function createPanelIdentity(panel) {
  const interval = resolveInterval(panel);
  const subscription = findSubscription(panel.symbol, interval);

  return {
    key: `${subscription.symbol}:${subscription.interval}`,
    symbol: subscription.symbol,
    interval: subscription.interval,
    streamName: subscription.streamName,
  };
}

function createPanelState(panel) {
  return {
    ...createPanelIdentity(panel),
    candles: [],
    status: PANEL_STATUS.IDLE,
    lastEventTime: null,
    lastKline: null,
    lastPrice: null,
    lastPriceTime: null,
    lastPriceSource: null,
    lastUpdatedFrom: null,
    error: null,
  };
}

function configureMarketDataSubscriptions(marketDataClient, panels) {
  if (typeof marketDataClient?.setSubscriptions !== "function") {
    return;
  }

  const subscriptions = [...new Map(
    panels.map((panel) => {
      const symbol = panel.symbol;
      const interval = resolveInterval(panel);
      const streamName = createKlineStreamName(symbol, interval);

      return [
        `${symbol}:${interval}`,
        {
          symbol,
          interval,
          streamName,
        },
      ];
    }),
  ).values()];

  const priceSubscriptions = [...new Map(
    panels.map((panel) => [
      panel.symbol,
      {
        symbol: panel.symbol,
        channel: "miniTicker",
        streamName: createMiniTickerStreamName(panel.symbol),
      },
    ]),
  ).values()];

  marketDataClient.setSubscriptions([
    ...subscriptions,
    ...priceSubscriptions,
  ]);
}

function createPanelSnapshot(state) {
  if (!state) {
    return null;
  }

  return {
    ...state,
    candles: state.candles.map(cloneCandle),
    lastKline: state.lastKline ? { ...state.lastKline } : null,
    error: cloneError(state.error),
  };
}

function normalizeKlineForSeries(kline) {
  return {
    openTime: kline.openTime,
    open: kline.open,
    high: kline.high,
    low: kline.low,
    close: kline.close,
    volume: kline.volume,
    closeTime: kline.closeTime,
    quoteVolume: kline.quoteVolume ?? 0,
    tradeCount: kline.tradeCount ?? 0,
    takerBuyBaseVolume: kline.takerBuyBaseVolume ?? 0,
    takerBuyQuoteVolume: kline.takerBuyQuoteVolume ?? 0,
    eventTime: kline.eventTime ?? kline.closeTime,
    isClosed: kline.isClosed ?? false,
  };
}

export function createChartPanelKey(panel) {
  return createPanelIdentity(panel).key;
}

export function mergeKlineIntoSeries(
  candles,
  kline,
  maxCandles = DEFAULT_PANEL_SEED_LIMIT,
) {
  const nextCandle = normalizeKlineForSeries(kline);
  const nextSeries = candles.map(cloneCandle);
  const existingIndex = nextSeries.findIndex(
    (candle) => candle.openTime === nextCandle.openTime,
  );

  if (existingIndex >= 0) {
    nextSeries[existingIndex] = {
      ...nextSeries[existingIndex],
      ...nextCandle,
    };
  } else {
    const insertIndex = nextSeries.findIndex(
      (candle) => candle.openTime > nextCandle.openTime,
    );

    if (insertIndex >= 0) {
      nextSeries.splice(insertIndex, 0, nextCandle);
    } else {
      nextSeries.push(nextCandle);
    }
  }

  return nextSeries.slice(-maxCandles);
}

export class BinanceChartFeed {
  #marketDataClient;

  #panels;

  #seedLimit;

  #states = new Map();

  #listeners = new Map();

  #startPromise = null;

  #isStreaming = false;

  constructor({
    marketDataClient = new BinanceMarketDataClient(),
    panels = chartPanels,
    seedLimit = DEFAULT_PANEL_SEED_LIMIT,
  } = {}) {
    this.#marketDataClient = marketDataClient;
    this.#panels = panels.map((panel) => ({
      ...panel,
      interval: resolveInterval(panel),
    }));
    this.#seedLimit = seedLimit;

    configureMarketDataSubscriptions(this.#marketDataClient, this.#panels);

    this.#panels.forEach((panel) => {
      const state = createPanelState(panel);
      this.#states.set(state.key, state);
    });
  }

  get panels() {
    return this.#panels.map((panel) => ({ ...panel }));
  }

  get keys() {
    return Array.from(this.#states.keys());
  }

  async start({ signal } = {}) {
    if (this.#startPromise) {
      await this.#startPromise;
      return this;
    }

    this.#startPromise = this.#primeAndConnect(signal);

    try {
      await this.#startPromise;
      return this;
    } catch (error) {
      this.#handleError(error);
      this.#startPromise = null;
      throw error;
    }
  }

  subscribe(panel, listener, { emitCurrent = true } = {}) {
    const key = createChartPanelKey(panel);
    const listeners = this.#listeners.get(key) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(key, listeners);

    if (emitCurrent) {
      listener(this.getSnapshot(panel));
    }

    return () => {
      const activeListeners = this.#listeners.get(key);

      if (!activeListeners) {
        return;
      }

      activeListeners.delete(listener);

      if (activeListeners.size === 0) {
        this.#listeners.delete(key);
      }
    };
  }

  getSnapshot(panel) {
    const key = createChartPanelKey(panel);
    return createPanelSnapshot(this.#states.get(key));
  }

  stop() {
    this.#startPromise = null;
    this.#isStreaming = false;
    this.#marketDataClient.disconnect();

    this.#states.forEach((state, key) => {
      this.#states.set(key, {
        ...state,
        status: PANEL_STATUS.STOPPED,
        error: null,
      });
      this.#emit(key);
    });
  }

  async #primeAndConnect(signal) {
    this.#setAllStatuses(PANEL_STATUS.LOADING);

    await Promise.all(
      this.#panels.map((panel) => this.#seedPanel(panel, signal)),
    );

    this.#marketDataClient.connect({
      onOpen: () => {
        this.#handleOpen();
      },
      onClose: () => {
        this.#handleClose();
      },
      onKline: (kline) => {
        this.#handleKline(kline);
      },
      onMiniTicker: (miniTicker) => {
        this.#handleMiniTicker(miniTicker);
      },
      onError: (error) => {
        this.#handleError(error);
      },
    });
  }

  async #seedPanel(panel, signal) {
    const identity = createPanelIdentity(panel);
    const candles = await this.#marketDataClient.fetchSeedKlines({
      symbol: identity.symbol,
      interval: identity.interval,
      limit: this.#seedLimit,
      signal,
    });

    const lastCandle = candles.at(-1) ?? null;

    this.#states.set(identity.key, {
      ...this.#states.get(identity.key),
      candles: candles.map(cloneCandle),
      status: PANEL_STATUS.READY,
      lastEventTime: lastCandle?.closeTime ?? null,
      lastKline: lastCandle ? cloneCandle(lastCandle) : null,
      lastPrice: lastCandle?.close ?? null,
      lastPriceTime: lastCandle?.closeTime ?? null,
      lastPriceSource: lastCandle ? "seed" : null,
      lastUpdatedFrom: "rest",
      error: null,
    });

    this.#emit(identity.key);
  }

  #handleOpen() {
    this.#isStreaming = true;

    this.#states.forEach((state, key) => {
      this.#states.set(key, {
        ...state,
        status: PANEL_STATUS.STREAMING,
        error: null,
      });
      this.#emit(key);
    });
  }

  #handleClose() {
    if (!this.#startPromise) {
      return;
    }

    this.#isStreaming = false;

    this.#states.forEach((state, key) => {
      if (state.status === PANEL_STATUS.STOPPED) {
        return;
      }

      this.#states.set(key, {
        ...state,
        status: state.candles.length > 0 ? PANEL_STATUS.READY : PANEL_STATUS.LOADING,
      });
      this.#emit(key);
    });
  }

  #handleKline(kline) {
    const key = createChartPanelKey({
      symbol: kline.symbol,
      interval: kline.interval,
    });

    if (!this.#states.has(key)) {
      return;
    }

    const state = this.#states.get(key);

    this.#states.set(key, {
      ...state,
      candles: mergeKlineIntoSeries(state.candles, kline, this.#seedLimit),
      status: this.#isStreaming ? PANEL_STATUS.STREAMING : state.status,
      lastEventTime: kline.eventTime,
      lastKline: { ...kline },
      lastPrice: kline.close,
      lastPriceTime: kline.eventTime ?? kline.closeTime,
      lastPriceSource: "kline",
      lastUpdatedFrom: "stream",
      error: null,
    });

    this.#emit(key);
  }

  #handleMiniTicker(miniTicker) {
    this.#states.forEach((state, key) => {
      if (state.symbol !== miniTicker.symbol) {
        return;
      }

      if (state.lastPrice === miniTicker.closePrice && state.lastPriceSource === "ticker") {
        return;
      }

      this.#states.set(key, {
        ...state,
        status: this.#isStreaming ? PANEL_STATUS.STREAMING : state.status,
        lastPrice: miniTicker.closePrice,
        lastPriceTime: miniTicker.eventTime,
        lastPriceSource: "ticker",
        error: null,
      });
      this.#emit(key);
    });
  }

  #handleError(error) {
    const resolvedError =
      error instanceof Error ? error : new Error(String(error));

    this.#states.forEach((state, key) => {
      this.#states.set(key, {
        ...state,
        status: PANEL_STATUS.ERROR,
        error: resolvedError,
      });
      this.#emit(key);
    });
  }

  #setAllStatuses(status) {
    this.#states.forEach((state, key) => {
      this.#states.set(key, {
        ...state,
        status,
        error: null,
      });
      this.#emit(key);
    });
  }

  #emit(key) {
    const listeners = this.#listeners.get(key);

    if (!listeners || listeners.size === 0) {
      return;
    }

    const snapshot = createPanelSnapshot(this.#states.get(key));

    listeners.forEach((listener) => {
      listener(snapshot);
    });
  }
}
