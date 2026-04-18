import test from "node:test";
import assert from "node:assert/strict";

import {
  REALTIME_SYMBOLS,
  applyRealtimeKline,
  createRealtimeCandleState,
  createRealtimeCandleStore,
  getRealtimeIntervalBucket,
  seedRealtimeInterval,
} from "../src/features/market-data/realtimeCandleStore.js";

function createSeedCandle(openTime, close) {
  return {
    openTime,
    closeTime: openTime + 59_999,
    open: close - 20,
    high: close + 30,
    low: close - 40,
    close,
    volume: 12.5,
    quoteVolume: 815_000,
    tradeCount: 120,
    takerBuyBaseVolume: 6.2,
    takerBuyQuoteVolume: 402_000,
  };
}

test("realtime candle state keeps recent candles per symbol and timeframe", () => {
  const state = createRealtimeCandleState({ maxCandles: 2 });

  seedRealtimeInterval(state, {
    symbol: "BTCUSDT",
    interval: "1m",
    receivedAt: 1712830200000,
    candles: [
      createSeedCandle(1712829960000, 68010.3),
      createSeedCandle(1712830020000, 68030.8),
      createSeedCandle(1712830080000, 68042.4),
    ],
  });
  seedRealtimeInterval(state, {
    symbol: "ETHUSDT",
    interval: "5m",
    receivedAt: 1712830500000,
    candles: [
      createSeedCandle(1712829900000, 3501.3),
      createSeedCandle(1712830200000, 3510.8),
    ],
  });

  assert.deepEqual(Object.keys(state.markets), REALTIME_SYMBOLS);
  assert.deepEqual(Object.keys(state.markets.BTCUSDT.series), ["1m", "5m"]);
  assert.deepEqual(Object.keys(state.markets.ETHUSDT.series), ["1m", "5m"]);
  assert.equal(state.markets.BTCUSDT.series["1m"].candles.length, 2);
  assert.equal(state.markets.BTCUSDT.series["1m"].candles[0].openTime, 1712830020000);
  assert.equal(state.markets.BTCUSDT.series["1m"].candles[1].close, 68042.4);
  assert.equal(state.markets.BTCUSDT.series["1m"].candles[1].isClosed, true);
  assert.equal(state.markets.BTCUSDT.series["1m"].updatedAt, 1712830200000);
  assert.equal(state.markets.ETHUSDT.series["5m"].candles[1].close, 3510.8);
  assert.equal(state.lastEventTime, 1712830259999);
});

test("realtime kline updates only the matching symbol/timeframe bucket", () => {
  const state = createRealtimeCandleState({ maxCandles: 2 });

  seedRealtimeInterval(state, {
    symbol: "BTCUSDT",
    interval: "5m",
    candles: [createSeedCandle(1712830200000, 68120.5)],
  });
  seedRealtimeInterval(state, {
    symbol: "ETHUSDT",
    interval: "1m",
    candles: [createSeedCandle(1712830440000, 3512.1)],
  });

  const applied = applyRealtimeKline(
    state,
    {
      symbol: "ETHUSDT",
      interval: "1m",
      eventTime: 1712830495000,
      openTime: 1712830440000,
      closeTime: 1712830499999,
      open: "3510.1",
      high: "3517.0",
      low: "3508.0",
      close: "3514.7",
      volume: "18.1",
      quoteVolume: "63500.4",
      tradeCount: 244,
      takerBuyBaseVolume: "9.2",
      takerBuyQuoteVolume: "32700.3",
      isClosed: false,
    },
    { receivedAt: 1712830495500 },
  );

  const ignored = applyRealtimeKline(state, {
    symbol: "BNBUSDT",
    interval: "1m",
    eventTime: 1712830497000,
    openTime: 1712830500000,
    closeTime: 1712830559999,
    open: "182.0",
    high: "183.0",
    low: "181.5",
    close: "182.5",
    volume: "32.0",
    isClosed: false,
  });

  assert.equal(applied, true);
  assert.equal(ignored, false);
  assert.equal(state.markets.ETHUSDT.series["1m"].candles.length, 1);
  assert.equal(state.markets.ETHUSDT.series["1m"].candles[0].close, 3514.7);
  assert.equal(state.markets.ETHUSDT.series["1m"].lastEventTime, 1712830495000);
  assert.equal(state.markets.BTCUSDT.series["5m"].candles[0].close, 68120.5);
  assert.equal(state.connectionStatus, "streaming");
});

test("realtime candle store hydrates all supported pairs and applies websocket updates", async () => {
  const fetchRequests = [];
  let socketHandlers = null;

  const client = {
    async fetchSeedKlines({ symbol, interval, limit }) {
      fetchRequests.push({ symbol, interval, limit });

      if (symbol === "BTCUSDT" && interval === "1m") {
        return [createSeedCandle(1712829960000, 68010.3)];
      }

      if (symbol === "BTCUSDT" && interval === "5m") {
        return [createSeedCandle(1712829900000, 67980.5)];
      }

      if (symbol === "ETHUSDT" && interval === "1m") {
        return [createSeedCandle(1712829960000, 3510.4)];
      }

      return [createSeedCandle(1712829900000, 3498.8)];
    },
    connect(handlers) {
      socketHandlers = handlers;
      return { close() {} };
    },
    disconnect() {},
  };

  const store = createRealtimeCandleStore({
    client,
    seedLimit: 1,
    maxCandles: 2,
  });

  await store.hydrate();
  store.connect();
  socketHandlers.onOpen();
  socketHandlers.onKline({
    symbol: "BTCUSDT",
    interval: "1m",
    eventTime: 1712830025000,
    openTime: 1712830020000,
    closeTime: 1712830079999,
    open: "68010.3",
    high: "68058.2",
    low: "67998.4",
    close: "68044.9",
    volume: "15.9",
    quoteVolume: "1081000.2",
    tradeCount: 163,
    takerBuyBaseVolume: "7.4",
    takerBuyQuoteVolume: "503000.1",
    isClosed: false,
  });
  socketHandlers.onKline({
    symbol: "ETHUSDT",
    interval: "5m",
    eventTime: 1712830205000,
    openTime: 1712830200000,
    closeTime: 1712830499999,
    open: "3498.8",
    high: "3508.1",
    low: "3494.2",
    close: "3505.6",
    volume: "48.3",
    quoteVolume: "169800.1",
    tradeCount: 189,
    takerBuyBaseVolume: "22.7",
    takerBuyQuoteVolume: "79800.4",
    isClosed: true,
  });

  const state = store.getState();
  const btcOneMinute = getRealtimeIntervalBucket(state, {
    symbol: "BTCUSDT",
    interval: "1m",
  });
  const ethFiveMinute = getRealtimeIntervalBucket(state, {
    symbol: "ETHUSDT",
    interval: "5m",
  });

  assert.deepEqual(
    fetchRequests,
    REALTIME_SYMBOLS.flatMap((symbol) => [
      { symbol, interval: "1m", limit: 1 },
      { symbol, interval: "5m", limit: 1 },
    ]),
  );
  assert.equal(state.connectionStatus, "streaming");
  assert.equal(btcOneMinute.candles.length, 2);
  assert.equal(btcOneMinute.candles[1].close, 68044.9);
  assert.equal(ethFiveMinute.candles.length, 2);
  assert.equal(ethFiveMinute.candles[1].close, 3505.6);
  assert.equal(ethFiveMinute.candles[1].isClosed, true);
  assert.equal(state.lastEventTime, 1712830205000);
});
