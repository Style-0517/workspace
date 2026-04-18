import test from "node:test";
import assert from "node:assert/strict";

import { createEmaPullbackTrendSignalEngine } from "../src/features/signals/emaPullbackTrendSignalEngine.js";

function createClosedCandle(openTime, { open, high, low, close, volume = 100 }) {
  return {
    openTime,
    closeTime: openTime + 179_999,
    open,
    high,
    low,
    close,
    volume,
    quoteVolume: volume * close,
    eventTime: openTime + 179_999,
    isClosed: true,
  };
}

const strategyOptions = {
  fastPeriod: 3,
  slowPeriod: 5,
  pullbackTolerancePercent: 0.0015,
  maxSlowEmaOvershootPercent: 0.003,
  reclaimBufferPercent: 0.0005,
  minCloseStrength: 0.55,
  minEmaGapPercent: 0.004,
  stopBufferPercent: 0.001,
  targetRiskRewardRatio: 1.8,
};

test("EMA pullback engine hydrates eligible symbols and emits one actionable alert", async () => {
  let currentNow = 1712831760799;
  let socketHandlers = null;
  let subscriptions = [];
  const notificationAlerts = [];
  const seedRequests = [];
  const baseOpenTime = 1712830200000;

  const btcSeedCandles = [
    createClosedCandle(baseOpenTime, {
      open: 99.8,
      high: 100.2,
      low: 99.7,
      close: 100,
    }),
    createClosedCandle(baseOpenTime + 180_000, {
      open: 100.2,
      high: 101.2,
      low: 100.1,
      close: 101,
    }),
    createClosedCandle(baseOpenTime + 360_000, {
      open: 101.1,
      high: 102.2,
      low: 101,
      close: 102,
    }),
    createClosedCandle(baseOpenTime + 540_000, {
      open: 102.2,
      high: 103.3,
      low: 102.1,
      close: 103,
    }),
    createClosedCandle(baseOpenTime + 720_000, {
      open: 103.2,
      high: 104.4,
      low: 103.1,
      close: 104,
    }),
    createClosedCandle(baseOpenTime + 900_000, {
      open: 104.1,
      high: 104.5,
      low: 103.8,
      close: 104.3,
    }),
    createClosedCandle(baseOpenTime + 1_080_000, {
      open: 104.15,
      high: 104.45,
      low: 103.45,
      close: 103.6,
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

      if (symbol === "ETHUSDT" && interval === "5m") {
        return btcSeedCandles.slice(0, 6);
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

  const engine = createEmaPullbackTrendSignalEngine({
    client,
    intervals: ["3m", "5m"],
    seedLimit: 7,
    maxCandles: 10,
    strategyOptions,
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
  assert.equal(subscriptions.length, 2);
  assert.equal(
    seedRequests.filter(({ symbol }) => symbol === "BTCUSDT").length,
    2,
  );
  assert.equal(
    seedRequests.filter(({ symbol }) => symbol === "ETHUSDT").length,
    2,
  );

  socketHandlers.onOpen();
  currentNow = 1712831640799;

  const confirmationKline = {
    symbol: "BTCUSDT",
    interval: "3m",
    eventTime: 1712831640000,
    openTime: baseOpenTime + 1_260_000,
    closeTime: baseOpenTime + 1_439_999,
    open: 103.7,
    high: 105,
    low: 103.6,
    close: 104.9,
    volume: 145,
    quoteVolume: 15_210.5,
    isClosed: true,
  };

  socketHandlers.onKline(confirmationKline);
  socketHandlers.onKline(confirmationKline);

  const state = engine.getState();

  assert.equal(state.connectionStatus, "streaming");
  assert.equal(state.alerts.length, 1);
  assert.equal(state.lastAlert.symbol, "BTCUSDT");
  assert.equal(state.lastAlert.interval, "3m");
  assert.equal(state.lastAlert.timeframe, "3m");
  assert.equal(state.lastAlert.route, "/markets/BTCUSDT/3m");
  assert.equal(state.lastAlert.recommendation, "manual-long-paper-trade");
  assert.equal(state.lastAlert.latencyMs, 799);
  assert.equal(state.lastAlert.confirmedSignal.symbol, "BTCUSDT");
  assert.equal(state.lastAlert.confirmedSignal.timeframe, "3m");
  assert.equal(
    state.lastAlert.confirmedSignal.entryPrice,
    state.lastAlert.entryPrice,
  );
  assert.equal(
    state.lastAlert.confirmedSignal.stopLoss,
    state.lastAlert.stopLoss,
  );
  assert.equal(
    state.lastAlert.confirmedSignal.takeProfit,
    state.lastAlert.takeProfit,
  );
  assert.equal(
    state.lastAlert.navigation.deepLink,
    "binance-signal-lite://signal-detail?alertId=ema-pullback%3ABTCUSDT%3A3m%3A1712831639999&symbol=BTCUSDT&timeframe=3m&formulaId=ema-pullback-reclaim-1m",
  );
  assert.equal(notificationAlerts.length, 1);
});
