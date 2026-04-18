import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTIVE_TIMEFRAME_STORAGE_KEY,
  DEFAULT_ACTIVE_TIMEFRAME,
  MONITORING_TIMEFRAMES,
  getMonitoringTimeframeLabel,
  getMonitoringTimeframeOptions,
  persistConfiguredActiveTimeframe,
  resolveConfiguredActiveTimeframe,
} from "../src/config/monitoringTimeframes.js";

test("monitoring timeframe config exposes only the lightweight app intervals", () => {
  assert.deepEqual(MONITORING_TIMEFRAMES, ["1m", "5m"]);
  assert.deepEqual(getMonitoringTimeframeOptions(), [
    { value: "1m", label: "1분봉" },
    { value: "5m", label: "5분봉" },
  ]);
});

test("configured active timeframe prefers explicit input, then query string, then storage", () => {
  const storage = new Map([[ACTIVE_TIMEFRAME_STORAGE_KEY, "5m"]]);

  assert.equal(
    resolveConfiguredActiveTimeframe({
      initialTimeframe: "5m",
      windowRef: {
        location: { href: "https://binance-signal-lite.local/?timeframe=1m" },
      },
      storage: {
        getItem(key) {
          return storage.get(key) ?? null;
        },
      },
    }),
    "5m",
  );

  assert.equal(
    resolveConfiguredActiveTimeframe({
      windowRef: {
        location: { href: "https://binance-signal-lite.local/?timeframe=1m" },
      },
      storage: {
        getItem(key) {
          return storage.get(key) ?? null;
        },
      },
    }),
    "1m",
  );

  assert.equal(
    resolveConfiguredActiveTimeframe({
      windowRef: {
        location: { href: "https://binance-signal-lite.local/" },
      },
      storage: {
        getItem(key) {
          return storage.get(key) ?? null;
        },
      },
    }),
    "5m",
  );
});

test("active timeframe persistence stores only supported values and falls back safely", () => {
  const writes = new Map();
  const storage = {
    getItem(key) {
      return writes.get(key) ?? null;
    },
    setItem(key, value) {
      writes.set(key, value);
    },
  };

  assert.equal(persistConfiguredActiveTimeframe(storage, "5m"), true);
  assert.equal(writes.get(ACTIVE_TIMEFRAME_STORAGE_KEY), "5m");
  assert.equal(persistConfiguredActiveTimeframe(storage, "30m"), false);
  assert.equal(getMonitoringTimeframeLabel("5m"), "5분봉");
  assert.equal(
    resolveConfiguredActiveTimeframe({
      windowRef: {
        location: { href: "https://binance-signal-lite.local/?timeframe=30m" },
      },
      storage: null,
    }),
    DEFAULT_ACTIVE_TIMEFRAME,
  );
});
