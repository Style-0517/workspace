import test from "node:test";
import assert from "node:assert/strict";

import { createStreamSubscriptions } from "../src/config/binanceStreams.js";
import {
  createLatestSignalCandleState,
} from "../src/features/market-data/latestSignalCandleState.js";
import {
  applyRealtimeKline,
  createRealtimeCandleState,
  seedRealtimeInterval,
} from "../src/features/market-data/realtimeCandleStore.js";

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

test("latest signal candle state normalizes the newest candle per subscribed market", () => {
  const marketData = createRealtimeCandleState({
    symbols: ["BTCUSDT", "ETHUSDT"],
    intervals: ["1m", "15m"],
    maxCandles: 2,
  });

  seedRealtimeInterval(marketData, {
    symbol: "BTCUSDT",
    interval: "1m",
    receivedAt: 1_710_000_010_000,
    candles: [createSeedCandle("BTCUSDT", "1m", 1_710_000_000_000, 68_120.5)],
  });
  seedRealtimeInterval(marketData, {
    symbol: "ETHUSDT",
    interval: "15m",
    receivedAt: 1_710_000_020_000,
    candles: [createSeedCandle("ETHUSDT", "15m", 1_710_000_000_000, 3_510.8)],
  });

  applyRealtimeKline(
    marketData,
    {
      symbol: "ETHUSDT",
      interval: "15m",
      eventTime: 1_710_000_025_000,
      openTime: 1_710_000_000_000,
      closeTime: 1_710_000_899_999,
      open: "3510.8",
      high: "3522.5",
      low: "3509.2",
      close: "3518.4",
      volume: "228.3",
      quoteVolume: "801220.2",
      tradeCount: 290,
      takerBuyBaseVolume: "109.7",
      takerBuyQuoteVolume: "385500.7",
      isClosed: false,
    },
    { receivedAt: 1_710_000_025_500 },
  );

  const latestCandleState = createLatestSignalCandleState({
    marketData,
    subscriptions: createStreamSubscriptions({
      symbols: ["BTCUSDT", "ETHUSDT"],
      intervals: ["1m", "15m"],
    }),
    asOf: 1_710_000_030_000,
  });

  assert.equal(latestCandleState.totalSubscriptions, 4);
  assert.equal(latestCandleState.activeSubscriptions, 2);
  assert.equal(latestCandleState.pendingSubscriptions, 2);
  assert.equal(latestCandleState.allSubscribedMarketsActive, false);
  assert.equal(
    latestCandleState.byKey["ETHUSDT:15m"].latestCandle.close,
    3518.4,
  );
  assert.equal(latestCandleState.byKey["ETHUSDT:15m"].status, "active");
  assert.equal(
    latestCandleState.bySymbol.ETHUSDT["15m"].latestCandle.isClosed,
    false,
  );
  assert.equal(latestCandleState.byKey["BTCUSDT:15m"].status, "pending");
});

test("latest signal candle state flags stale subscriptions when updates fall behind the interval window", () => {
  const marketData = createRealtimeCandleState({
    symbols: ["BTCUSDT", "ETHUSDT"],
    intervals: ["1m"],
    maxCandles: 1,
  });

  seedRealtimeInterval(marketData, {
    symbol: "BTCUSDT",
    interval: "1m",
    receivedAt: 10_000,
    candles: [createSeedCandle("BTCUSDT", "1m", 0, 68_010.3)],
  });
  seedRealtimeInterval(marketData, {
    symbol: "ETHUSDT",
    interval: "1m",
    receivedAt: 20_000,
    candles: [createSeedCandle("ETHUSDT", "1m", 0, 3_510.4)],
  });

  const latestCandleState = createLatestSignalCandleState({
    marketData,
    subscriptions: createStreamSubscriptions({
      symbols: ["BTCUSDT", "ETHUSDT"],
      intervals: ["1m"],
    }),
    asOf: 75_000,
  });

  assert.equal(latestCandleState.activeSubscriptions, 1);
  assert.equal(latestCandleState.staleSubscriptions, 1);
  assert.equal(latestCandleState.pendingSubscriptions, 0);
  assert.equal(latestCandleState.allSubscribedMarketsActive, false);
  assert.equal(latestCandleState.byKey["BTCUSDT:1m"].status, "stale");
  assert.equal(latestCandleState.byKey["ETHUSDT:1m"].status, "active");
  assert.deepEqual(latestCandleState.staleSymbols, ["BTCUSDT"]);
});
