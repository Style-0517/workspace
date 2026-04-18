import test from "node:test";
import assert from "node:assert/strict";

import { createBollingerSqueezeBreakoutSignalEngine } from "../src/features/signals/bollingerSqueezeBreakoutSignalEngine.js";

const INTERVAL_CLOSE_OFFSETS = {
  "5m": 299_999,
  "15m": 899_999,
};

function createClosedCandle(interval, openTime, values) {
  return {
    openTime,
    closeTime: openTime + INTERVAL_CLOSE_OFFSETS[interval],
    eventTime: openTime + INTERVAL_CLOSE_OFFSETS[interval],
    quoteVolume: values.volume * values.close,
    isClosed: true,
    ...values,
  };
}

function createBtcSeedCandles(interval, baseOpenTime) {
  return [
    createClosedCandle(interval, baseOpenTime, {
      open: 100,
      high: 100.3,
      low: 99.8,
      close: 100.05,
      volume: 100,
    }),
    createClosedCandle(interval, baseOpenTime + 300_000, {
      open: 100.05,
      high: 100.25,
      low: 99.9,
      close: 100.1,
      volume: 102,
    }),
    createClosedCandle(interval, baseOpenTime + 600_000, {
      open: 100.1,
      high: 100.22,
      low: 99.92,
      close: 100.02,
      volume: 97,
    }),
    createClosedCandle(interval, baseOpenTime + 900_000, {
      open: 100.02,
      high: 100.2,
      low: 99.95,
      close: 100.08,
      volume: 99,
    }),
    createClosedCandle(interval, baseOpenTime + 1_200_000, {
      open: 100.08,
      high: 100.18,
      low: 99.94,
      close: 100.04,
      volume: 101,
    }),
    createClosedCandle(interval, baseOpenTime + 1_500_000, {
      open: 100.03,
      high: 100.16,
      low: 99.97,
      close: 100.09,
      volume: 100,
    }),
    createClosedCandle(interval, baseOpenTime + 1_800_000, {
      open: 100.07,
      high: 100.14,
      low: 99.99,
      close: 100.05,
      volume: 98,
    }),
    createClosedCandle(interval, baseOpenTime + 2_100_000, {
      open: 100.05,
      high: 100.18,
      low: 100,
      close: 100.11,
      volume: 102,
    }),
  ];
}

const strategyOptions = {
  period: 5,
  standardDeviationMultiplier: 2,
  squeezeLookback: 3,
  volumeLookback: 3,
  maxSqueezeBandwidthPercent: 0.006,
  minBandwidthExpansionRatio: 1.4,
  breakoutCloseBufferPercent: 0.001,
  minVolumeMultiplier: 1.5,
  minBodyToRangeRatio: 0.45,
  stopBufferPercent: 0.001,
  targetRiskRewardRatio: 1.8,
};

test("Bollinger squeeze engine hydrates eligible symbols and emits one actionable alert", async () => {
  let currentNow = 1712832900649;
  let socketHandlers = null;
  let subscriptions = [];
  const notificationAlerts = [];
  const seedRequests = [];
  const baseOpenTime = 1712830200000;

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
        return createBtcSeedCandles(interval, baseOpenTime).slice(0, 7);
      }

      return createBtcSeedCandles(interval, baseOpenTime);
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

  const engine = createBollingerSqueezeBreakoutSignalEngine({
    client,
    intervals: ["5m", "15m"],
    seedLimit: 8,
    maxCandles: 12,
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
  currentNow = 1712832900649;

  const breakoutKline = {
    symbol: "BTCUSDT",
    interval: "5m",
    eventTime: 1712832899999,
    openTime: baseOpenTime + 2_400_000,
    closeTime: baseOpenTime + 2_699_999,
    open: 100.08,
    high: 101.3,
    low: 100.04,
    close: 101.18,
    volume: 220,
    quoteVolume: 22_259.6,
    isClosed: true,
  };

  socketHandlers.onKline(breakoutKline);
  socketHandlers.onKline(breakoutKline);

  const state = engine.getState();

  assert.equal(state.connectionStatus, "streaming");
  assert.equal(state.alerts.length, 1);
  assert.equal(state.lastAlert.symbol, "BTCUSDT");
  assert.equal(state.lastAlert.interval, "5m");
  assert.equal(state.lastAlert.timeframe, "5m");
  assert.equal(state.lastAlert.route, "/markets/BTCUSDT/5m");
  assert.equal(state.lastAlert.recommendation, "manual-long-paper-trade");
  assert.equal(state.lastAlert.tradeBias, "long");
  assert.equal(state.lastAlert.latencyMs, 650);
  assert.equal(state.lastAlert.confirmedSignal.symbol, "BTCUSDT");
  assert.equal(state.lastAlert.confirmedSignal.timeframe, "5m");
  assert.equal(
    state.lastAlert.navigation.deepLink,
    "binance-signal-lite://signal-detail?alertId=bollinger-squeeze%3ABTCUSDT%3A5m%3Abullish%3A1712832899999&symbol=BTCUSDT&timeframe=5m&formulaId=bollinger-squeeze-breakout-5m",
  );
  assert.equal(notificationAlerts.length, 1);
});
