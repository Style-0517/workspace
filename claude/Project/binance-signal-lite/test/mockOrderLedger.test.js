import test from "node:test";
import assert from "node:assert/strict";

import { createMockOrderLedger } from "../src/features/orders/mockOrderLedger.js";

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

test("mockOrderLedger records orders and updates virtual cash balance", () => {
  const storage = createMemoryStorage();
  const ledger = createMockOrderLedger({ storage });

  const firstOrder = ledger.placeOrder({
    symbol: "BTCUSDT",
    timeframe: "1m",
    formulaId: "ema-pullback-reclaim-1m",
    side: "buy",
    notional: 250,
    marketPrice: 100000,
  });

  assert.equal(firstOrder.ok, true);
  assert.equal(firstOrder.order.orderType, "market");
  assert.equal(firstOrder.order.status, "filled");
  assert.equal(ledger.getState().availableCash, 9750);

  const secondOrder = ledger.placeOrder({
    symbol: "BTCUSDT",
    timeframe: "1m",
    formulaId: "ema-pullback-reclaim-1m",
    side: "sell",
    notional: 50,
    marketPrice: 101000,
  });

  assert.equal(secondOrder.ok, true);
  assert.equal(ledger.getState().availableCash, 9800);

  const rehydrated = createMockOrderLedger({ storage });
  assert.equal(rehydrated.getState().orders.length, 2);
  assert.equal(rehydrated.getState().availableCash, 9800);
});

test("mockOrderLedger prevents buy orders that exceed available balance", () => {
  const ledger = createMockOrderLedger();

  const result = ledger.placeOrder({
    symbol: "ETHUSDT",
    timeframe: "5m",
    formulaId: "bollinger-squeeze-breakout-5m",
    side: "buy",
    notional: 10001,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /가상 잔고/);
});

test("mockOrderLedger keeps limit orders pending until the market crosses", () => {
  const ledger = createMockOrderLedger();

  const result = ledger.placeOrder({
    symbol: "BTCUSDT",
    timeframe: "1m",
    formulaId: "ema-pullback-reclaim-1m",
    side: "buy",
    orderType: "limit",
    notional: 150,
    referencePrice: 99000,
    marketPrice: 100000,
  });

  assert.equal(result.ok, true);
  assert.equal(result.order.status, "pending");
  assert.equal(ledger.getState().availableCash, 10000);

  const tickResult = ledger.processMarketTick({
    symbol: "BTCUSDT",
    lastPrice: 98950,
    tickedAt: "2026-04-15T12:00:00.000Z",
  });

  assert.equal(tickResult.ok, true);
  assert.equal(tickResult.filledOrders.length, 1);
  assert.equal(tickResult.filledOrders[0].status, "filled");
  assert.equal(ledger.getState().availableCash, 9850);
  assert.equal(ledger.getState().orders[0].filledAt, "2026-04-15T12:00:00.000Z");
});

test("mockOrderLedger executes market orders immediately at the live price", () => {
  const ledger = createMockOrderLedger();

  const result = ledger.placeOrder({
    symbol: "ETHUSDT",
    timeframe: "5m",
    formulaId: "bollinger-squeeze-breakout-5m",
    side: "buy",
    orderType: "market",
    notional: 80,
    marketPrice: 2450.125,
  });

  assert.equal(result.ok, true);
  assert.equal(result.order.status, "filled");
  assert.equal(result.order.executionPrice, 2450.125);
  assert.equal(ledger.getState().availableCash, 9920);
});

test("mockOrderLedger requires an applied signal for auto orders", () => {
  const ledger = createMockOrderLedger();

  const rejected = ledger.placeOrder({
    symbol: "BTCUSDT",
    timeframe: "1m",
    formulaId: "ema-pullback-reclaim-1m",
    side: "buy",
    orderType: "auto",
    notional: 90,
    marketPrice: 100000,
  });

  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /신호/);

  const accepted = ledger.placeOrder({
    symbol: "BTCUSDT",
    timeframe: "1m",
    formulaId: "ema-pullback-reclaim-1m",
    side: "buy",
    orderType: "auto",
    notional: 90,
    referencePrice: 99850,
    marketPrice: 100000,
    sourceAlertId: "alert:btc:auto",
  });

  assert.equal(accepted.ok, true);
  assert.equal(accepted.order.orderType, "auto");
  assert.equal(accepted.order.executionPrice, 99850);
});

test("mockOrderLedger rejects sells when there is no filled position", () => {
  const ledger = createMockOrderLedger();

  const result = ledger.placeOrder({
    symbol: "BTCUSDT",
    timeframe: "1m",
    formulaId: "ema-pullback-reclaim-1m",
    side: "sell",
    orderType: "market",
    notional: 50,
    marketPrice: 100000,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /보유 중인 포지션/);
});
