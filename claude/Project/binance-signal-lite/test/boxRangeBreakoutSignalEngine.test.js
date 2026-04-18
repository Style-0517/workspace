import test from "node:test";
import assert from "node:assert/strict";

import { createBoxRangeBreakoutSignalEngine } from "../src/features/signals/boxRangeBreakoutSignalEngine.js";

function createClosedCandle(openTime, { open, high, low, close, volume }) {
  return {
    openTime,
    closeTime: openTime + 59_999,
    open,
    high,
    low,
    close,
    volume,
    quoteVolume: volume * close,
    eventTime: openTime + 59_999,
    isClosed: true,
  };
}

test("signal engine hydrates eligible watchlist symbols and emits a single breakout alert", async () => {
  let currentNow = 1712830559500;
  let socketHandlers = null;
  let subscriptions = [];
  const notificationAlerts = [];
  const seedRequests = [];
  const baseOpenTime = 1712830200000;

  const btcSeedCandles = [
    createClosedCandle(baseOpenTime, {
      open: 99.4,
      high: 99.6,
      low: 99.2,
      close: 99.5,
      volume: 92,
    }),
    createClosedCandle(baseOpenTime + 60_000, {
      open: 99.95,
      high: 100.2,
      low: 99.8,
      close: 100.1,
      volume: 100,
    }),
    createClosedCandle(baseOpenTime + 120_000, {
      open: 100.05,
      high: 100.25,
      low: 99.9,
      close: 100.15,
      volume: 102,
    }),
    createClosedCandle(baseOpenTime + 180_000, {
      open: 100.1,
      high: 100.3,
      low: 99.92,
      close: 100.02,
      volume: 98,
    }),
    createClosedCandle(baseOpenTime + 240_000, {
      open: 99.98,
      high: 100.28,
      low: 99.85,
      close: 100.2,
      volume: 105,
    }),
  ];

  const client = {
    async fetchSignalUniverse() {
      return {
        symbols: ["BTCUSDT", "ETHUSDT"],
        markets: [
          {
            symbol: "BTCUSDT",
            baseAsset: "BTC",
            quoteAsset: "USDT",
            rank: 1,
            quoteVolume: 81_600_000,
          },
          {
            symbol: "ETHUSDT",
            baseAsset: "ETH",
            quoteAsset: "USDT",
            rank: 2,
            quoteVolume: 31_500_000,
          },
        ],
      };
    },
    async fetchSeedKlines({ symbol, interval, limit }) {
      seedRequests.push({ symbol, interval, limit });

      if (symbol === "ETHUSDT" && interval === "15m") {
        return btcSeedCandles.slice(0, 4);
      }

      return btcSeedCandles;
    },
    setSubscriptions(nextSubscriptions) {
      subscriptions = nextSubscriptions;
      return subscriptions;
    },
    connect(handlers) {
      socketHandlers = handlers;
      return { close() {} };
    },
    disconnect() {},
  };

  const engine = createBoxRangeBreakoutSignalEngine({
    client,
    intervals: ["1m", "5m", "15m"],
    seedLimit: 5,
    maxCandles: 8,
    breakoutOptions: {
      rangeLookback: 4,
      volumeLookback: 3,
      maxRangePercent: 0.02,
      breakoutBufferPercent: 0.001,
      minVolumeMultiplier: 1.8,
      minBodyToRangeRatio: 0.3,
    },
    notificationDispatcher: (alert) => {
      notificationAlerts.push(alert);
    },
    now: () => currentNow,
  });

  await engine.start();

  const hydratedState = engine.getState();
  assert.deepEqual(
    hydratedState.candidateMarkets.map(({ symbol }) => symbol),
    ["BTCUSDT", "ETHUSDT"],
  );
  assert.deepEqual(
    hydratedState.monitoredMarkets.map(({ symbol }) => symbol),
    ["BTCUSDT"],
  );
  assert.equal(subscriptions.length, 3);
  assert.equal(
    seedRequests.filter(({ symbol }) => symbol === "BTCUSDT").length,
    3,
  );
  assert.equal(
    seedRequests.filter(({ symbol }) => symbol === "ETHUSDT").length,
    3,
  );

  socketHandlers.onOpen();
  currentNow = 1712830500500;

  const breakoutKline = {
    symbol: "BTCUSDT",
    interval: "1m",
    eventTime: 1712830500000,
    openTime: 1712830500000,
    closeTime: 1712830559999,
    open: 100.18,
    high: 101.45,
    low: 100.1,
    close: 101.35,
    volume: 230,
    quoteVolume: 23_310.5,
    isClosed: true,
  };

  socketHandlers.onKline(breakoutKline);
  socketHandlers.onKline(breakoutKline);

  const state = engine.getState();

  assert.equal(state.connectionStatus, "streaming");
  assert.equal(state.alerts.length, 1);
  assert.equal(state.lastAlert.symbol, "BTCUSDT");
  assert.equal(state.lastAlert.interval, "1m");
  assert.equal(state.lastAlert.timeframe, "1m");
  assert.equal(state.lastAlert.formulaId, "opening-range-breakout-1m");
  assert.equal(state.lastAlert.entryPrice, 101.35);
  assert.ok(state.lastAlert.stopLoss < state.lastAlert.entryPrice);
  assert.ok(state.lastAlert.takeProfit > state.lastAlert.entryPrice);
  assert.equal(state.lastAlert.route, "/markets/BTCUSDT/1m");
  assert.equal(state.lastAlert.confirmedSignal.symbol, "BTCUSDT");
  assert.equal(state.lastAlert.confirmedSignal.timeframe, "1m");
  assert.equal(
    state.lastAlert.confirmedSignal.entryPrice,
    state.lastAlert.entryPrice,
  );
  assert.equal(state.lastAlert.latencyMs, 500);
  assert.equal(notificationAlerts.length, 1);
});
