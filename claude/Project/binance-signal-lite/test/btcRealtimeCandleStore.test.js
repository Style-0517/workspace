import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBtcRealtimeKline,
  BTC_SYMBOL,
  createBtcRealtimeCandleStore,
  createBtcRealtimeState,
  seedBtcInterval,
} from "../src/features/market-data/btcRealtimeCandleStore.js";

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

test("BTC realtime state keeps dedicated 1m/5m series and seeds parsed candles", () => {
  const state = createBtcRealtimeState({ maxCandles: 2 });

  seedBtcInterval(state, {
    interval: "1m",
    receivedAt: 1712830200000,
    candles: [
      createSeedCandle(1712829960000, 68010.3),
      createSeedCandle(1712830020000, 68030.8),
      createSeedCandle(1712830080000, 68042.4),
    ],
  });

  assert.deepEqual(Object.keys(state.series), ["1m", "5m"]);
  assert.equal(state.series["1m"].candles.length, 2);
  assert.equal(state.series["1m"].candles[0].openTime, 1712830020000);
  assert.equal(state.series["1m"].candles[1].close, 68042.4);
  assert.equal(state.series["1m"].candles[1].isClosed, true);
  assert.equal(state.series["1m"].updatedAt, 1712830200000);
});

test("BTC realtime kline upserts the right interval and ignores non-BTC payloads", () => {
  const state = createBtcRealtimeState({ maxCandles: 2 });

  seedBtcInterval(state, {
    interval: "5m",
    candles: [createSeedCandle(1712830200000, 68120.5)],
  });

  const applied = applyBtcRealtimeKline(
    state,
    {
      symbol: BTC_SYMBOL,
      interval: "5m",
      eventTime: 1712830495000,
      openTime: 1712830200000,
      closeTime: 1712830499999,
      open: "68100.1",
      high: "68145.0",
      low: "68090.0",
      close: "68132.7",
      volume: "18.1",
      quoteVolume: "1235000.4",
      tradeCount: 244,
      takerBuyBaseVolume: "9.2",
      takerBuyQuoteVolume: "627000.3",
      isClosed: false,
    },
    { receivedAt: 1712830495500 },
  );

  const ignored = applyBtcRealtimeKline(state, {
    symbol: "ETHUSDT",
    interval: "5m",
    eventTime: 1712830497000,
    openTime: 1712830500000,
    closeTime: 1712830799999,
    open: "3510.0",
    high: "3520.0",
    low: "3500.0",
    close: "3515.0",
    volume: "32.0",
    isClosed: false,
  });

  assert.equal(applied, true);
  assert.equal(ignored, false);
  assert.equal(state.series["5m"].candles.length, 1);
  assert.equal(state.series["5m"].candles[0].close, 68132.7);
  assert.equal(state.series["5m"].lastEventTime, 1712830495000);
  assert.equal(state.connectionStatus, "streaming");
});

test("BTC realtime store hydrates both intervals and applies websocket updates", async () => {
  const fetchRequests = [];
  let socketHandlers = null;

  const client = {
    async fetchSeedKlines({ symbol, interval, limit }) {
      fetchRequests.push({ symbol, interval, limit });

      if (interval === "1m") {
        return [createSeedCandle(1712829960000, 68010.3)];
      }

      return [createSeedCandle(1712829900000, 67980.5)];
    },
    connect(handlers) {
      socketHandlers = handlers;
      return { close() {} };
    },
    disconnect() {},
  };

  const store = createBtcRealtimeCandleStore({
    client,
    seedLimit: 1,
    maxCandles: 2,
  });

  await store.hydrate();
  store.connect();
  socketHandlers.onOpen();
  socketHandlers.onKline({
    symbol: BTC_SYMBOL,
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

  const state = store.getState();

  assert.deepEqual(fetchRequests, [
    { symbol: "BTCUSDT", interval: "1m", limit: 1 },
    { symbol: "BTCUSDT", interval: "5m", limit: 1 },
  ]);
  assert.equal(state.connectionStatus, "streaming");
  assert.equal(state.series["1m"].candles.length, 2);
  assert.equal(state.series["1m"].candles[1].close, 68044.9);
  assert.equal(state.series["5m"].candles.length, 1);
  assert.equal(state.lastEventTime, 1712830025000);
});
