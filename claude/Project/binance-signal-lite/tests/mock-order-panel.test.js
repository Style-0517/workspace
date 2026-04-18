import test from "node:test";
import assert from "node:assert/strict";

import { getMockOrderPanelMarkup } from "../src/components/mockOrderPanel.js";

test("mock order panel markup exposes virtual cash, form fields, and history", () => {
  const markup = getMockOrderPanelMarkup({
    ledgerState: {
      availableCash: 9800,
      currency: "USDT",
      orders: [
        {
          id: "order:1",
          symbol: "BTCUSDT",
          timeframe: "1m",
          formulaId: "ema-pullback-reclaim-1m",
          side: "buy",
          notional: 200,
          balanceAfterOrder: 9800,
        },
      ],
    },
    draft: {
      symbol: "BTCUSDT",
      timeframe: "1m",
      formulaId: "ema-pullback-reclaim-1m",
      side: "buy",
      notional: "100",
      referencePrice: "100.1",
      note: "",
      sourceAlertId: "",
      sourceLabel: "",
    },
  });

  assert.ok(markup.includes("가상 주문 입력"));
  assert.ok(markup.includes("9800.00 USDT"));
  assert.ok(markup.includes('name="notional"'));
  assert.ok(markup.includes("최근 주문"));
});
