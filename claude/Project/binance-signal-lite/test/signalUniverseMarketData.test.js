import test from "node:test";
import assert from "node:assert/strict";

import { createStreamSubscriptions } from "../src/config/binanceStreams.js";
import {
  getRealtimeIntervalBucket,
} from "../src/features/market-data/realtimeCandleStore.js";
import {
  SIGNAL_UNIVERSE_INTERVALS,
  createSignalUniverseMarketData,
} from "../src/features/market-data/signalUniverseMarketData.js";

const INTERVAL_CLOSE_OFFSETS = {
  "1m": 59_999,
  "3m": 179_999,
  "5m": 299_999,
  "15m": 899_999,
};

function createSeedCandle(symbol, interval, openTime, close) {
  return {
    symbol,
    interval,
    openTime,
    closeTime: openTime + INTERVAL_CLOSE_OFFSETS[interval],
    open: close - 2,
    high: close + 3,
    low: close - 4,
    close,
    volume: 18.5,
    quoteVolume: 91_500,
    tradeCount: 140,
    takerBuyBaseVolume: 8.2,
    takerBuyQuoteVolume: 42_100,
  };
}

class FakeUniverseClient {
  constructor() {
    this.fetchUniverseCalls = [];
    this.fetchSeedCalls = [];
    this.disconnectCount = 0;
    this.connectCount = 0;
    this.handlers = null;
    this._subscriptions = [];
  }

  get subscriptions() {
    return this._subscriptions.map((subscription) => ({ ...subscription }));
  }

  get streamNames() {
    return this._subscriptions.map(({ streamName }) => streamName);
  }

  async fetchSignalUniverse({ config, now }) {
    this.fetchUniverseCalls.push({ config, now });

    return {
      asOf: now,
      size: config.size,
      quoteAsset: "USDT",
      rankingMetric: config.rankingMetric,
      symbols: ["BTCUSDT", "SOLUSDT"],
      markets: [
        {
          symbol: "BTCUSDT",
          rank: 1,
          rankingValue: 1_500_000_000,
        },
        {
          symbol: "SOLUSDT",
          rank: 2,
          rankingValue: 950_000_000,
        },
      ],
    };
  }

  setSubscriptions(subscriptions) {
    this._subscriptions = subscriptions.map((subscription) => ({ ...subscription }));
    return this.subscriptions;
  }

  async fetchSeedKlines({ symbol, interval, limit }) {
    this.fetchSeedCalls.push({ symbol, interval, limit });

    return [
      createSeedCandle(symbol, interval, 1712830000000, symbol === "BTCUSDT" ? 68000 : 180),
    ];
  }

  connect(handlers) {
    this.connectCount += 1;
    this.handlers = handlers;

    return {
      close() {},
    };
  }

  disconnect() {
    this.disconnectCount += 1;
    this.handlers = null;
  }

  emitOpen() {
    this.handlers?.onOpen?.();
  }

  emitKline(kline) {
    this.handlers?.onKline?.(kline);
  }
}

test("signal universe market data hydrates configured top pairs and applies realtime candles across 4 timeframes", async () => {
  const now = Date.UTC(2026, 3, 12);
  const client = new FakeUniverseClient();
  const ingestion = createSignalUniverseMarketData({
    client,
    universeConfig: {
      size: 20,
      rankingMetric: "quoteVolume",
    },
    seedLimit: 1,
    maxCandles: 2,
  });

  const snapshots = [];
  ingestion.subscribe((snapshot) => {
    snapshots.push(snapshot);
  });

  await ingestion.hydrate({ now });

  assert.deepEqual(client.fetchUniverseCalls, [
    {
      config: {
        size: 20,
        rankingMetric: "quoteVolume",
      },
      now,
    },
  ]);
  assert.deepEqual(
    client.subscriptions,
    createStreamSubscriptions({
      symbols: ["BTCUSDT", "SOLUSDT"],
      intervals: SIGNAL_UNIVERSE_INTERVALS,
    }),
  );
  assert.deepEqual(
    client.fetchSeedCalls,
    ["BTCUSDT", "SOLUSDT"].flatMap((symbol) =>
      SIGNAL_UNIVERSE_INTERVALS.map((interval) => ({
        symbol,
        interval,
        limit: 1,
      })),
    ),
  );

  ingestion.connect();
  client.emitOpen();
  client.emitKline({
    symbol: "SOLUSDT",
    interval: "15m",
    eventTime: 1712830900000,
    openTime: 1712830900000,
    closeTime: 1712831799999,
    open: "181.0",
    high: "190.5",
    low: "179.4",
    close: "189.4",
    volume: "421.8",
    quoteVolume: "78890.2",
    tradeCount: 311,
    takerBuyBaseVolume: "205.3",
    takerBuyQuoteVolume: "38420.5",
    isClosed: true,
  });

  const snapshot = ingestion.getSnapshot();
  const latestCandleState = ingestion.getLatestCandleState({ now: Date.now() });
  const solFifteenMinute = getRealtimeIntervalBucket(snapshot.marketData, {
    symbol: "SOLUSDT",
    interval: "15m",
  });

  assert.equal(client.connectCount, 1);
  assert.equal(snapshot.universe.symbols.length, 2);
  assert.equal(snapshot.marketData.connectionStatus, "streaming");
  assert.equal(solFifteenMinute.candles.length, 2);
  assert.equal(solFifteenMinute.candles.at(-1).close, 189.4);
  assert.equal(solFifteenMinute.candles.at(-1).isClosed, true);
  assert.equal(solFifteenMinute.lastEventTime, 1712830900000);
  assert.equal(snapshot.latestCandleState.totalSubscriptions, 8);
  assert.equal(
    snapshot.latestCandleState.byKey["SOLUSDT:15m"].latestCandle.close,
    189.4,
  );
  assert.equal(
    snapshot.latestCandleState.bySymbol.SOLUSDT["15m"].streamName,
    "solusdt@kline_15m",
  );
  assert.equal(latestCandleState.activeSubscriptions, 8);
  assert.equal(latestCandleState.allSubscribedMarketsActive, true);
  assert.ok(snapshots.length >= 4);
});
