import test from "node:test";
import assert from "node:assert/strict";

import { createFormulaMatchMonitor } from "../src/features/signals/formulaMatchMonitor.js";

function createFakeAlertStore() {
  const items = [];

  return {
    items,
    recordMatch(alert) {
      items.push(alert);
      return alert;
    },
  };
}

function createFakeMarketData(panels) {
  const listeners = new Map();

  return {
    panels,
    subscribe(panel, listener) {
      listeners.set(`${panel.symbol}:${panel.timeframe}`, listener);
      return () => {
        listeners.delete(`${panel.symbol}:${panel.timeframe}`);
      };
    },
    emit(panel, snapshot) {
      listeners.get(`${panel.symbol}:${panel.timeframe}`)?.(snapshot);
    },
  };
}

test("formulaMatchMonitor records a single alert when a detector matches a panel snapshot", () => {
  const panel = { symbol: "BTCUSDT", timeframe: "1m" };
  const marketData = createFakeMarketData([panel]);
  const alertStore = createFakeAlertStore();
  const monitor = createFormulaMatchMonitor({
    marketData,
    alertStore,
    formulas: [
      {
        id: "ema-pullback-reclaim-1m",
        name: "EMA",
        detection: {
          timeframe: "1m",
          symbols: ["BTCUSDT"],
          signalType: "trend-continuation",
        },
      },
    ],
    detectors: {
      "ema-pullback-reclaim-1m": () => ({
        signalType: "trend-continuation",
        entryPrice: 100,
        stopLoss: 99,
        takeProfit: 102,
        confirmationCandle: {
          openTime: 123,
          closeTime: 456,
        },
      }),
    },
  });

  monitor.start();
  marketData.emit(panel, {
    candles: [{ openTime: 1, closeTime: 2, isClosed: true }],
    lastEventTime: 456,
  });
  marketData.emit(panel, {
    candles: [{ openTime: 1, closeTime: 2, isClosed: true }],
    lastEventTime: 456,
  });

  assert.equal(alertStore.items.length, 1);
  assert.equal(alertStore.items[0].symbol, "BTCUSDT");
  assert.equal(alertStore.items[0].timeframe, "1m");
});
