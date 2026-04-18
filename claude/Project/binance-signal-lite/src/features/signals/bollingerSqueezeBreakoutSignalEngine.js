import {
  DEFAULT_BINANCE_UNIVERSE_CONFIG,
  UNIVERSE_SIZE_RANGE,
} from "../../config/binanceUniverse.js";
import {
  SIGNAL_INTERVALS,
  createSignalSubscriptions,
  isSupportedSignalInterval,
  normalizeSignalWatchlistSize,
} from "../../config/binanceSignalStreams.js";
import {
  applyRealtimeKline,
  cloneRealtimeCandleState,
  createRealtimeCandleState,
  getRealtimeIntervalBucket,
  seedRealtimeInterval,
} from "../market-data/realtimeCandleStore.js";
import { createConfirmedSignalAlert } from "../alerts/confirmedSignalAlert.js";
import {
  BOLLINGER_SQUEEZE_BREAKOUT_STRATEGY_ID,
  BOLLINGER_SQUEEZE_FORMULA_ID,
  BOLLINGER_SQUEEZE_SIGNAL_TYPE,
  DEFAULT_BOLLINGER_SQUEEZE_OPTIONS,
  detectBollingerSqueezeBreakoutSignal,
  getRequiredBollingerSqueezeCandles,
} from "./bollingerSqueezeBreakoutStrategy.js";

export const DEFAULT_BOLLINGER_SIGNAL_SEED_LIMIT = 60;
export const DEFAULT_BOLLINGER_SIGNAL_ALERT_LIMIT = 50;

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function cloneMarket(entry) {
  return { ...entry };
}

function cloneAlert(alert) {
  return { ...alert };
}

function isTrackableSymbol(symbol) {
  return typeof symbol === "string" && symbol.endsWith("USDT");
}

function getUniverseSeedSize(requestedSize) {
  return Math.min(UNIVERSE_SIZE_RANGE.max, requestedSize + 5);
}

function createRecommendation(direction) {
  return direction === "bullish"
    ? "manual-long-paper-trade"
    : "protect-capital-breakdown";
}

function createTradeBias(direction) {
  return direction === "bullish" ? "long" : "defensive";
}

function createAlert({
  market,
  interval,
  detection,
  eventTime,
  detectedAt,
}) {
  const candleCloseTime =
    detection.breakoutCandle.closeTime ?? detection.breakoutCandle.eventTime ?? null;
  const id = [
    "bollinger-squeeze",
    market.symbol,
    interval,
    detection.direction,
    candleCloseTime ?? detectedAt,
  ].join(":");
  const confirmedSignal = createConfirmedSignalAlert({
    alertId: id,
    symbol: market.symbol,
    timeframe: interval,
    formulaId: BOLLINGER_SQUEEZE_FORMULA_ID,
    signalType: BOLLINGER_SQUEEZE_SIGNAL_TYPE,
    direction: createTradeBias(detection.direction),
    rationale: detection.explanation,
    confirmedAt: candleCloseTime ?? detectedAt,
  });

  return {
    id,
    strategyId: BOLLINGER_SQUEEZE_BREAKOUT_STRATEGY_ID,
    formulaId: BOLLINGER_SQUEEZE_FORMULA_ID,
    signalType: BOLLINGER_SQUEEZE_SIGNAL_TYPE,
    symbol: market.symbol,
    interval,
    timeframe: interval,
    baseAsset: market.baseAsset,
    quoteAsset: market.quoteAsset,
    direction: detection.direction,
    tradeBias: createTradeBias(detection.direction),
    recommendation: createRecommendation(detection.direction),
    rank: market.rank,
    quoteVolume24h: market.quoteVolume,
    entryPrice: detection.entryPrice,
    triggerPrice: detection.triggerPrice,
    stopLoss: detection.stopLoss,
    takeProfit: detection.takeProfit,
    riskAmount: detection.riskAmount,
    riskPercent: detection.riskPercent,
    rewardAmount: detection.rewardAmount,
    rewardPercent: detection.rewardPercent,
    targetRiskRewardRatio: detection.targetRiskRewardRatio,
    averageSqueezeBandwidthPercent: detection.averageSqueezeBandwidthPercent,
    maximumSqueezeBandwidthPercent: detection.maximumSqueezeBandwidthPercent,
    breakoutBandwidthPercent: detection.breakoutBandwidthPercent,
    bandwidthExpansionRatio: detection.bandwidthExpansionRatio,
    baselineVolume: detection.baselineVolume,
    breakoutVolume: detection.breakoutVolume,
    volumeRatio: detection.volumeRatio,
    bodyToRangeRatio: detection.bodyToRangeRatio,
    closeStrength: detection.closeStrength,
    breakoutDistancePercent: detection.breakoutDistancePercent,
    confidence: detection.confidence,
    explanation: detection.explanation,
    breakoutCandle: { ...detection.breakoutCandle },
    previousCandle: { ...detection.previousCandle },
    route: `/markets/${market.symbol}/${interval}`,
    navigation: confirmedSignal.navigation,
    confirmedSignal,
    eventTime: eventTime ?? null,
    candleCloseTime,
    detectedAt,
    latencyMs: Math.max(0, detectedAt - (eventTime ?? detectedAt)),
  };
}

export function createBollingerSqueezeBreakoutSignalEngine({
  client,
  watchlistSize = DEFAULT_BINANCE_UNIVERSE_CONFIG.size,
  intervals = SIGNAL_INTERVALS,
  seedLimit = DEFAULT_BOLLINGER_SIGNAL_SEED_LIMIT,
  maxCandles = seedLimit,
  alertLimit = DEFAULT_BOLLINGER_SIGNAL_ALERT_LIMIT,
  strategyOptions = DEFAULT_BOLLINGER_SQUEEZE_OPTIONS,
  notificationDispatcher,
  now = () => Date.now(),
} = {}) {
  if (!client) {
    throw new Error("Binance market data client is required");
  }

  if (typeof client.fetchSignalUniverse !== "function") {
    throw new Error("Binance market data client must support fetchSignalUniverse()");
  }

  if (typeof client.fetchSeedKlines !== "function") {
    throw new Error("Binance market data client must support fetchSeedKlines()");
  }

  if (typeof client.setSubscriptions !== "function") {
    throw new Error("Binance market data client must support setSubscriptions()");
  }

  const trackedIntervals = [...new Set(intervals)];
  const normalizedWatchlistSize = normalizeSignalWatchlistSize(watchlistSize);
  const mergedStrategyOptions = {
    ...DEFAULT_BOLLINGER_SQUEEZE_OPTIONS,
    ...strategyOptions,
  };
  const minimumSeedCandles =
    getRequiredBollingerSqueezeCandles(mergedStrategyOptions);
  const listeners = new Set();
  const emittedAlertIds = new Set();

  if (seedLimit < minimumSeedCandles) {
    throw new Error(
      `seedLimit must be at least ${minimumSeedCandles} candles for Bollinger squeeze detection`,
    );
  }

  if (maxCandles < minimumSeedCandles) {
    throw new Error(
      `maxCandles must be at least ${minimumSeedCandles} candles for Bollinger squeeze detection`,
    );
  }

  let watchlistStatus = "idle";
  let connectionStatus = "idle";
  let lastError = null;
  let candidateMarkets = [];
  let monitoredMarkets = [];
  let candleState = null;
  let alerts = [];
  let lastAlert = null;
  let isStopped = false;

  trackedIntervals.forEach((interval) => {
    if (!isSupportedSignalInterval(interval)) {
      throw new Error(`Unsupported signal interval: ${interval}`);
    }
  });

  const getState = () => ({
    strategyId: BOLLINGER_SQUEEZE_BREAKOUT_STRATEGY_ID,
    formulaId: BOLLINGER_SQUEEZE_FORMULA_ID,
    signalType: BOLLINGER_SQUEEZE_SIGNAL_TYPE,
    watchlistStatus,
    connectionStatus,
    intervals: [...trackedIntervals],
    candidateMarkets: candidateMarkets.map(cloneMarket),
    monitoredMarkets: monitoredMarkets.map(cloneMarket),
    marketState: candleState ? cloneRealtimeCandleState(candleState) : null,
    alerts: alerts.map(cloneAlert),
    lastAlert: lastAlert ? cloneAlert(lastAlert) : null,
    lastError,
  });

  const emit = () => {
    const snapshot = getState();
    listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  };

  const maybeDispatchAlert = (alert) => {
    if (!notificationDispatcher) {
      return;
    }

    try {
      const dispatchResult = notificationDispatcher(alert);

      if (dispatchResult && typeof dispatchResult.catch === "function") {
        dispatchResult.catch((error) => {
          lastError = `Notification dispatch failed: ${toErrorMessage(error)}`;
          emit();
        });
      }
    } catch (error) {
      lastError = `Notification dispatch failed: ${toErrorMessage(error)}`;
    }
  };

  const evaluateSignal = (symbol, interval, eventTime) => {
    if (!candleState) {
      return null;
    }

    const bucket = getRealtimeIntervalBucket(candleState, {
      symbol,
      interval,
    });
    const detection = detectBollingerSqueezeBreakoutSignal(
      bucket.candles,
      mergedStrategyOptions,
    );

    if (!detection) {
      return null;
    }

    const market = monitoredMarkets.find((entry) => entry.symbol === symbol);

    if (!market) {
      return null;
    }

    const alert = createAlert({
      market,
      interval,
      detection,
      eventTime,
      detectedAt: now(),
    });

    if (emittedAlertIds.has(alert.id)) {
      return null;
    }

    emittedAlertIds.add(alert.id);
    alerts = [alert, ...alerts].slice(0, alertLimit);
    lastAlert = alert;
    maybeDispatchAlert(alert);
    return alert;
  };

  const handleKline = (kline) => {
    if (!candleState) {
      return false;
    }

    const applied = applyRealtimeKline(candleState, kline);

    if (!applied) {
      return false;
    }

    connectionStatus = "streaming";

    if (kline.isClosed) {
      evaluateSignal(kline.symbol, kline.interval, kline.eventTime);
    }

    emit();
    return true;
  };

  const hydrate = async ({ signal } = {}) => {
    watchlistStatus = "loading";
    lastError = null;
    emit();

    try {
      const universe = await client.fetchSignalUniverse({
        config: {
          ...DEFAULT_BINANCE_UNIVERSE_CONFIG,
          size: getUniverseSeedSize(normalizedWatchlistSize),
        },
        signal,
        now: now(),
      });

      candidateMarkets = universe.markets.map(cloneMarket);

      const seedResults = await Promise.all(
        candidateMarkets.map(async (market) => {
          const intervalSeeds = await Promise.all(
            trackedIntervals.map(async (interval) => ({
              interval,
              candles: await client.fetchSeedKlines({
                symbol: market.symbol,
                interval,
                limit: seedLimit,
                signal,
              }),
            })),
          );

          return {
            market,
            intervalSeeds,
          };
        }),
      );

      monitoredMarkets = seedResults
        .filter(({ intervalSeeds }) =>
          intervalSeeds.every(
            ({ candles }) => candles.length >= minimumSeedCandles,
          ),
        )
        .slice(0, normalizedWatchlistSize)
        .map(({ market }) => cloneMarket(market));

      if (monitoredMarkets.length === 0) {
        throw new Error("No eligible Binance Spot USDT pairs had enough candle history");
      }

      candleState = createRealtimeCandleState({
        symbols: monitoredMarkets.map(({ symbol }) => symbol),
        intervals: trackedIntervals,
        maxCandles,
        validateSymbol: isTrackableSymbol,
        validateInterval: (interval) =>
          trackedIntervals.includes(interval) && isSupportedSignalInterval(interval),
      });

      seedResults.forEach(({ market, intervalSeeds }) => {
        if (!monitoredMarkets.find((entry) => entry.symbol === market.symbol)) {
          return;
        }

        intervalSeeds.forEach(({ interval, candles }) => {
          seedRealtimeInterval(candleState, {
            symbol: market.symbol,
            interval,
            candles,
          });
        });
      });

      client.setSubscriptions(
        createSignalSubscriptions(
          monitoredMarkets.map(({ symbol }) => symbol),
          trackedIntervals,
        ),
      );

      watchlistStatus = "ready";
      connectionStatus = "hydrated";
      lastError = null;
      return emit();
    } catch (error) {
      watchlistStatus = "error";
      lastError = toErrorMessage(error);
      emit();
      throw error;
    }
  };

  const connect = () => {
    if (!candleState) {
      throw new Error("hydrate() must complete before connect()");
    }

    isStopped = false;
    connectionStatus = "connecting";
    emit();

    return client.connect({
      onOpen: () => {
        connectionStatus = "connected";
        lastError = null;
        emit();
      },
      onKline: handleKline,
      onClose: () => {
        connectionStatus = isStopped ? "disconnected" : "reconnecting";
        emit();
      },
      onError: (error) => {
        lastError = toErrorMessage(error);
        emit();
      },
    });
  };

  const start = async ({ signal } = {}) => {
    await hydrate({ signal });
    connect();
    return getState();
  };

  const disconnect = () => {
    isStopped = true;
    client.disconnect?.();
    connectionStatus = "disconnected";
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
    subscribe,
    hydrate,
    connect,
    disconnect,
    start,
  };
}
