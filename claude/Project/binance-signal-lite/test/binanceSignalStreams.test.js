import test from "node:test";
import assert from "node:assert/strict";

import {
  SIGNAL_INTERVALS,
  createSignalStreamName,
  createSignalSubscriptions,
  normalizeSignalWatchlistSize,
} from "../src/config/binanceSignalStreams.js";

test("signal stream config supports 1m 3m 5m 15m subscriptions", () => {
  assert.deepEqual(SIGNAL_INTERVALS, ["1m", "3m", "5m", "15m"]);
  assert.equal(createSignalStreamName("BTCUSDT", "3m"), "btcusdt@kline_3m");
  assert.deepEqual(
    createSignalSubscriptions(["BTCUSDT", "ETHUSDT"], ["1m", "15m"]),
    [
      { symbol: "BTCUSDT", interval: "1m", streamName: "btcusdt@kline_1m" },
      { symbol: "BTCUSDT", interval: "15m", streamName: "btcusdt@kline_15m" },
      { symbol: "ETHUSDT", interval: "1m", streamName: "ethusdt@kline_1m" },
      { symbol: "ETHUSDT", interval: "15m", streamName: "ethusdt@kline_15m" },
    ],
  );
});

test("signal watchlist size stays within the 20-30 pair MVP range", () => {
  assert.equal(normalizeSignalWatchlistSize(25), 25);
  assert.throws(
    () => normalizeSignalWatchlistSize(19),
    /between 20 and 30/,
  );
});
