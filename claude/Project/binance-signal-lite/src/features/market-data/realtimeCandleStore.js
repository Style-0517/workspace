import {
  DEFAULT_STREAM_INTERVALS,
  SUPPORTED_SYMBOLS,
  isSupportedInterval,
  isSupportedSymbol,
} from "../../config/binanceStreams.js";
import { DEFAULT_KLINE_LIMIT } from "../../services/binanceMarketDataClient.js";

export const REALTIME_SYMBOLS = Object.freeze([...SUPPORTED_SYMBOLS]);
export const REALTIME_INTERVALS = Object.freeze([...DEFAULT_STREAM_INTERVALS]);

function assertTrackedSymbol(state, symbol) {
  if (!state.markets[symbol]) {
    throw new Error(`Unsupported realtime symbol: ${symbol}`);
  }
}

function assertTrackedInterval(state, symbol, interval) {
  assertTrackedSymbol(state, symbol);

  if (!state.markets[symbol].series[interval]) {
    throw new Error(`Unsupported realtime interval: ${interval}`);
  }
}

function createIntervalBucket(interval) {
  return {
    interval,
    candles: [],
    lastEventTime: null,
    lastOpenTime: null,
    lastCloseTime: null,
    updatedAt: null,
  };
}

function createMarketState(symbol, intervals) {
  return {
    symbol,
    lastEventTime: null,
    lastMessageAt: null,
    updatedAt: null,
    series: Object.fromEntries(
      intervals.map((interval) => [interval, createIntervalBucket(interval)]),
    ),
  };
}

function cloneIntervalBucket(bucket) {
  return {
    ...bucket,
    candles: bucket.candles.map((candle) => ({ ...candle })),
  };
}

function cloneMarketState(marketState) {
  return {
    ...marketState,
    series: Object.fromEntries(
      Object.entries(marketState.series).map(([interval, bucket]) => [
        interval,
        cloneIntervalBucket(bucket),
      ]),
    ),
  };
}

function normalizeCollection(values, validator, label) {
  const uniqueValues = [...new Set(values)];

  if (uniqueValues.length === 0) {
    throw new Error(`At least one ${label} is required`);
  }

  uniqueValues.forEach((value) => {
    if (!validator(value)) {
      throw new Error(`Unsupported ${label}: ${value}`);
    }
  });

  return uniqueValues;
}

function toStoredCandle(candle) {
  return {
    openTime: candle.openTime,
    closeTime: candle.closeTime,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: Number(candle.volume ?? 0),
    quoteVolume: Number(candle.quoteVolume ?? 0),
    tradeCount: candle.tradeCount ?? 0,
    takerBuyBaseVolume: Number(candle.takerBuyBaseVolume ?? 0),
    takerBuyQuoteVolume: Number(candle.takerBuyQuoteVolume ?? 0),
    eventTime: candle.eventTime ?? candle.closeTime ?? null,
    isClosed: candle.isClosed ?? true,
  };
}

function trimToMaxCandles(candles, maxCandles) {
  if (candles.length > maxCandles) {
    candles.splice(0, candles.length - maxCandles);
  }
}

function upsertCandle(candles, nextCandle) {
  const existingIndex = candles.findIndex(
    ({ openTime }) => openTime === nextCandle.openTime,
  );

  if (existingIndex >= 0) {
    candles[existingIndex] = nextCandle;
    return;
  }

  candles.push(nextCandle);
  candles.sort((left, right) => left.openTime - right.openTime);
}

function updateStateTimestamps(state, marketState, bucket, receivedAt) {
  marketState.lastEventTime = bucket.lastEventTime;
  marketState.lastMessageAt = receivedAt;
  marketState.updatedAt = receivedAt;

  state.lastEventTime = bucket.lastEventTime;
  state.lastMessageAt = receivedAt;
}

function getTrackedBucket(state, symbol, interval) {
  const marketState = state.markets[symbol];
  const bucket = marketState?.series?.[interval];

  if (!bucket) {
    return null;
  }

  return { marketState, bucket };
}

export function createRealtimeCandleState({
  symbols = REALTIME_SYMBOLS,
  intervals = REALTIME_INTERVALS,
  maxCandles = DEFAULT_KLINE_LIMIT,
  validateSymbol = isSupportedSymbol,
  validateInterval = isSupportedInterval,
} = {}) {
  const trackedSymbols = normalizeCollection(
    symbols,
    validateSymbol,
    "realtime symbol",
  );
  const trackedIntervals = normalizeCollection(
    intervals,
    validateInterval,
    "realtime interval",
  );

  return {
    symbols: trackedSymbols,
    intervals: trackedIntervals,
    maxCandles,
    connectionStatus: "idle",
    lastEventTime: null,
    lastMessageAt: null,
    lastError: null,
    markets: Object.fromEntries(
      trackedSymbols.map((symbol) => [
        symbol,
        createMarketState(symbol, trackedIntervals),
      ]),
    ),
  };
}

export function cloneRealtimeCandleState(state) {
  return {
    ...state,
    symbols: [...state.symbols],
    intervals: [...state.intervals],
    markets: Object.fromEntries(
      Object.entries(state.markets).map(([symbol, marketState]) => [
        symbol,
        cloneMarketState(marketState),
      ]),
    ),
  };
}

export function getRealtimeIntervalBucket(state, { symbol, interval }) {
  assertTrackedInterval(state, symbol, interval);
  return cloneIntervalBucket(state.markets[symbol].series[interval]);
}

export function seedRealtimeInterval(
  state,
  { symbol, interval, candles, receivedAt = Date.now() },
) {
  assertTrackedInterval(state, symbol, interval);

  const { marketState, bucket } = getTrackedBucket(state, symbol, interval);

  bucket.candles = candles
    .map(toStoredCandle)
    .sort((left, right) => left.openTime - right.openTime)
    .slice(-state.maxCandles);

  const lastCandle = bucket.candles.at(-1) ?? null;

  bucket.lastEventTime = lastCandle?.eventTime ?? null;
  bucket.lastOpenTime = lastCandle?.openTime ?? null;
  bucket.lastCloseTime = lastCandle?.closeTime ?? null;
  bucket.updatedAt = receivedAt;

  updateStateTimestamps(state, marketState, bucket, receivedAt);
  state.lastError = null;

  return state;
}

export function applyRealtimeKline(
  state,
  kline,
  { receivedAt = Date.now() } = {},
) {
  const trackedBucket = getTrackedBucket(state, kline.symbol, kline.interval);

  if (!trackedBucket) {
    return false;
  }

  const { marketState, bucket } = trackedBucket;
  const nextCandle = toStoredCandle(kline);

  upsertCandle(bucket.candles, nextCandle);
  trimToMaxCandles(bucket.candles, state.maxCandles);

  bucket.lastEventTime = nextCandle.eventTime ?? receivedAt;
  bucket.lastOpenTime = nextCandle.openTime;
  bucket.lastCloseTime = nextCandle.closeTime;
  bucket.updatedAt = receivedAt;

  updateStateTimestamps(state, marketState, bucket, receivedAt);
  state.connectionStatus = "streaming";
  state.lastError = null;

  return true;
}

export function createRealtimeCandleStore({
  client,
  symbols = REALTIME_SYMBOLS,
  intervals = REALTIME_INTERVALS,
  seedLimit = DEFAULT_KLINE_LIMIT,
  maxCandles = seedLimit,
  validateSymbol = isSupportedSymbol,
  validateInterval = isSupportedInterval,
} = {}) {
  if (!client) {
    throw new Error("Binance market data client is required");
  }

  const state = createRealtimeCandleState({
    symbols,
    intervals,
    maxCandles,
    validateSymbol,
    validateInterval,
  });
  const listeners = new Set();
  let isStopped = false;

  const emit = () => {
    const snapshot = cloneRealtimeCandleState(state);
    listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  };

  const getState = () => cloneRealtimeCandleState(state);

  const hydrate = async ({ signal } = {}) => {
    state.connectionStatus = "hydrating";
    emit();

    try {
      const requests = state.symbols.flatMap((symbol) =>
        state.intervals.map(async (interval) => ({
          symbol,
          interval,
          candles: await client.fetchSeedKlines({
            symbol,
            interval,
            limit: seedLimit,
            signal,
          }),
        })),
      );

      const results = await Promise.all(requests);

      results.forEach(({ symbol, interval, candles }) => {
        seedRealtimeInterval(state, {
          symbol,
          interval,
          candles,
        });
      });

      state.connectionStatus = "hydrated";
      state.lastError = null;

      return emit();
    } catch (error) {
      state.connectionStatus = "error";
      state.lastError = error instanceof Error ? error.message : String(error);
      emit();
      throw error;
    }
  };

  const applyKline = (kline) => {
    const applied = applyRealtimeKline(state, kline);

    if (applied) {
      emit();
    }

    return applied;
  };

  const connect = () => {
    isStopped = false;
    state.connectionStatus = "connecting";
    emit();

    return client.connect({
      onOpen: () => {
        state.connectionStatus = "connected";
        state.lastError = null;
        emit();
      },
      onKline: applyKline,
      onClose: () => {
        state.connectionStatus = isStopped ? "disconnected" : "reconnecting";
        emit();
      },
      onError: (error) => {
        state.lastError = error instanceof Error ? error.message : String(error);
        emit();
      },
    });
  };

  const disconnect = () => {
    isStopped = true;
    client.disconnect?.();
    state.connectionStatus = "disconnected";
    emit();
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    listener(getState());

    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getState,
    hydrate,
    connect,
    disconnect,
    subscribe,
    applyKline,
  };
}
