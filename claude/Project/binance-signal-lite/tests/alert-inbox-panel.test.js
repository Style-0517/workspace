import test from "node:test";
import assert from "node:assert/strict";

import { getAlertInboxPanelMarkup } from "../src/components/alertInboxPanel.js";

test("alert inbox markup renders latest alert summary and action buttons", () => {
  const markup = getAlertInboxPanelMarkup({
    selectedAlertId: "alert:1",
    alerts: [
      {
        id: "alert:1",
        symbol: "BTCUSDT",
        timeframe: "1m",
        formulaName: "EMA",
        explanation: "EMA 일치",
        detectedAt: "2026-04-12T00:00:00.000Z",
        entryPrice: 100,
        stopLoss: 99,
        takeProfit: 102,
        status: "new",
      },
    ],
  });

  assert.ok(markup.includes("매매법 일치 알림"));
  assert.ok(markup.includes("주문에 적용"));
  assert.ok(markup.includes("BTCUSDT"));
  assert.ok(markup.includes("EMA"));
});
