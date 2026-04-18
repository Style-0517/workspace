import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTradeMarkers,
  summarizeOrderPerformance,
} from "../src/features/orders/orderAnalytics.js";

test("order analytics summarizes open position and unrealized pnl", () => {
  const performance = summarizeOrderPerformance({
    symbol: "BTCUSDT",
    marketPrice: 110,
    orders: [
      {
        id: "order:1",
        symbol: "BTCUSDT",
        timeframe: "1m",
        side: "buy",
        status: "filled",
        notional: 100,
        executionPrice: 100,
        filledAt: "2026-04-15T12:00:00.000Z",
      },
    ],
  });

  assert.equal(performance.position.quantity, 1);
  assert.equal(performance.position.avgEntryPrice, 100);
  assert.equal(performance.position.marketValue, 110);
  assert.equal(performance.position.unrealizedPnl, 10);
  assert.equal(performance.position.unrealizedPnlPct, 10);
});

test("order analytics tracks realized pnl and win rate on exits", () => {
  const performance = summarizeOrderPerformance({
    symbol: "BTCUSDT",
    marketPrice: 112,
    orders: [
      {
        id: "buy:1",
        symbol: "BTCUSDT",
        timeframe: "1m",
        side: "buy",
        status: "filled",
        notional: 100,
        executionPrice: 100,
        filledAt: "2026-04-15T12:00:00.000Z",
      },
      {
        id: "buy:2",
        symbol: "BTCUSDT",
        timeframe: "1m",
        side: "buy",
        status: "filled",
        notional: 50,
        executionPrice: 100,
        filledAt: "2026-04-15T12:02:00.000Z",
      },
      {
        id: "sell:1",
        symbol: "BTCUSDT",
        timeframe: "1m",
        side: "sell",
        status: "filled",
        notional: 55,
        executionPrice: 110,
        filledAt: "2026-04-15T12:10:00.000Z",
      },
    ],
  });

  assert.equal(performance.position.quantity, 1);
  assert.equal(performance.position.realizedPnl, 5);
  assert.equal(performance.position.unrealizedPnl, 12);
  assert.equal(performance.stats.closedTradeCount, 1);
  assert.equal(performance.stats.winRate, 100);
});

test("trade markers expose filled and pending orders for chart overlays", () => {
  const markers = buildTradeMarkers({
    symbol: "BTCUSDT",
    orders: [
      {
        id: "pending:1",
        symbol: "BTCUSDT",
        side: "buy",
        status: "pending",
        placedAt: "2026-04-15T11:59:00.000Z",
      },
      {
        id: "buy:1",
        symbol: "BTCUSDT",
        side: "buy",
        status: "filled",
        filledAt: "2026-04-15T12:00:00.000Z",
      },
      {
        id: "sell:1",
        symbol: "BTCUSDT",
        side: "sell",
        status: "filled",
        filledAt: "2026-04-15T12:05:00.000Z",
      },
    ],
  });

  assert.equal(markers.length, 3);
  assert.equal(markers[0].text, "대기");
  assert.equal(markers[1].text, "매수");
  assert.equal(markers[2].text, "매도");
});
