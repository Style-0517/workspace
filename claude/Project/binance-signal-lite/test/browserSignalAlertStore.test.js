import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserSignalAlertStore } from "../src/features/alerts/browserSignalAlertStore.js";

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("browserSignalAlertStore stores alerts, avoids duplicates, and persists selection state", () => {
  const storage = createMemoryStorage();
  const store = createBrowserSignalAlertStore({ storage });

  const firstAlert = store.recordMatch({
    formulaId: "ema-pullback-reclaim-1m",
    formulaName: "1분 EMA 눌림목 복귀",
    symbol: "BTCUSDT",
    timeframe: "1m",
    signalType: "trend-continuation",
    explanation: "EMA 정렬 후 회복",
    detectedAt: "2026-04-12T00:00:00.000Z",
    detectedCandleOpenTime: 100,
    entryPrice: 100.5,
    stopLoss: 99.5,
    takeProfit: 102.3,
  });

  const duplicateAlert = store.recordMatch({
    formulaId: "ema-pullback-reclaim-1m",
    formulaName: "1분 EMA 눌림목 복귀",
    symbol: "BTCUSDT",
    timeframe: "1m",
    signalType: "trend-continuation",
    explanation: "EMA 정렬 후 회복",
    detectedAt: "2026-04-12T00:00:01.000Z",
    detectedCandleOpenTime: 100,
  });

  assert.equal(firstAlert.id, duplicateAlert.id);
  assert.equal(store.getState().items.length, 1);

  assert.equal(store.selectAlert(firstAlert.id), true);
  assert.equal(store.acknowledge(firstAlert.id), true);

  const rehydrated = createBrowserSignalAlertStore({ storage });
  assert.equal(rehydrated.getState().selectedAlertId, firstAlert.id);
  assert.equal(rehydrated.getState().items[0].status, "acknowledged");
});
