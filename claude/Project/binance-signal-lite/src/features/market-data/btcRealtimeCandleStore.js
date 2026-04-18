import { DEFAULT_KLINE_LIMIT } from "../../services/binanceMarketDataClient.js";

export const BTC_SYMBOL = "BTCUSDT";
export const BTC_REALTIME_INTERVALS = Object.freeze(["1m", "5m"]);

function assertSupportedInterval(interval) {
  if (!BTC_REALTIME_INTERVALS.includes(interval)) {
    throw new Error(`Unsupported BTC realtime interval: ${interval}`);
  }
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
    isClosed: candle.isClosed ?? true,
  };
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

function cloneBucket(bucket) {
  return {
    ...bucket,
    candles: bucket.candles.map((candle) => ({ ...candle })),
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

export function createBtcRealtimeState({
  maxCandles = DEFAULT_KLINE_LIMIT,
} = {}) {
  return {
    symbol: BTC_SYMBOL,
    maxCandles,
    connectionStatus: "idle",
    lastEventTime: null,
    lastMessageAt: null,
    lastError: null,
    series: {
      "1m": createIntervalBucket("1m"),
      "5m": createIntervalBucket("5m"),
    },
  };
}

export function cloneBtcRealtimeState(state) {
  return {
    ...state,
    series: {
      "1m": cloneBucket(state.series["1m"]),
      "5m": cloneBucket(state.series["5m"]),
    },
  };
}

export function seedBtcInterval(
  state,
  { interval, candles, receivedAt = Date.now() },
) {
  assertSupportedInterval(interval);

  const bucket = state.series[interval];
  bucket.candles = candles
    .map(toStoredCandle)
    .sort((left, right) => left.openTime - right.openTime)
    .slice(-state.maxCandles);
  bucket.lastOpenTime = bucket.candles.at(-1)?.openTime ?? null;
  bucket.lastCloseTime = bucket.candles.at(-1)?.closeTime ?? null;
  bucket.updatedAt = receivedAt;

  return state;
}

export function applyBtcRealtimeKline(
  state,
  kline,
  { receivedAt = Date.now() } = {},
) {
  if (kline.symbol !== BTC_SYMBOL || !BTC_REALTIME_INTERVALS.includes(kline.interval)) {
    return false;
  }

  const bucket = state.series[kline.interval];
  const nextCandle = toStoredCandle(kline);

  upsertCandle(bucket.candles, nextCandle);
  trimToMaxCandles(bucket.candles, state.maxCandles);

  bucket.lastEventTime = kline.eventTime ?? receivedAt;
  bucket.lastOpenTime = nextCandle.openTime;
  bucket.lastCloseTime = nextCandle.closeTime;
  bucket.updatedAt = receivedAt;

  state.connectionStatus = "streaming";
  state.lastEventTime = bucket.lastEventTime;
  state.lastMessageAt = receivedAt;
  state.lastError = null;

  return true;
}

export function createBtcRealtimeCandleStore({
  client,
  seedLimit = DEFAULT_KLINE_LIMIT,
  maxCandles = seedLimit,
} = {}) {
  if (!client) {
    throw new Error("Binance market data client is required");
  }

  const state = createBtcRealtimeState({ maxCandles });
  const listeners = new Set();
  let isStopped = false;

  const emit = () => {
    const snapshot = cloneBtcRealtimeState(state);
    listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  };

  const getState = () => cloneBtcRealtimeState(state);

  const hydrate = async ({ signal } = {}) => {
    state.connectionStatus = "hydrating";
    emit();

    try {
      const [oneMinuteCandles, fiveMinuteCandles] = await Promise.all(
        BTC_REALTIME_INTERVALS.map((interval) =>
          client.fetchSeedKlines({
            symbol: BTC_SYMBOL,
            interval,
            limit: seedLimit,
            signal,
          }),
        ),
      );

      seedBtcInterval(state, {
        interval: "1m",
        candles: oneMinuteCandles,
      });
      seedBtcInterval(state, {
        interval: "5m",
        candles: fiveMinuteCandles,
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
    const applied = applyBtcRealtimeKline(state, kline);

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
