import test from "node:test";
import assert from "node:assert/strict";

import { getMonitoringTimeframePickerMarkup } from "../src/components/monitoringTimeframePicker.js";

test("시간봉 선택기 마크업은 현재 시간봉 트리거와 1m·5m 드롭다운 옵션을 노출한다", () => {
  const markup = getMonitoringTimeframePickerMarkup({
    activeTimeframe: "5m",
    isOpen: true,
  });

  assert.equal((markup.match(/data-timeframe=/g) ?? []).length, 2);
  assert.ok(markup.includes("1분봉"));
  assert.ok(markup.includes("5분봉"));
  assert.ok(markup.includes("monitoring-timeframe-picker__trigger-value\">5m"));
  assert.ok(markup.includes('data-timeframe="5m"'));
  assert.ok(markup.includes("monitoring-timeframe-picker__option is-active"));
  assert.ok(markup.includes("monitoring-timeframe-picker__menu is-open"));
});
