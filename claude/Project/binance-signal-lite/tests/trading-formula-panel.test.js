import test from "node:test";
import assert from "node:assert/strict";

import { getTradingFormulaPanelMarkup } from "../src/components/tradingFormulaPanel.js";
import { TRADING_FORMULAS } from "../src/features/trading-formulas/trading-formulas.js";

test("공식 패널 마크업은 등록된 3개 공식을 모두 목록으로 표시한다", () => {
  const markup = getTradingFormulaPanelMarkup();

  assert.equal((markup.match(/data-formula-id=/g) ?? []).length, 3);

  for (const formula of TRADING_FORMULAS) {
    assert.ok(markup.includes(formula.name));
  }
});

test("공식 패널은 선택한 공식의 상세 조건을 보여주고 편집 UI를 포함하지 않는다", () => {
  const markup = getTradingFormulaPanelMarkup({
    selectedFormulaId: "bollinger-squeeze-breakout-5m",
  });

  assert.ok(markup.includes("5분 볼린저 스퀴즈 돌파"));
  assert.ok(markup.includes("current.bbWidthPct &gt;= avg(previous.bbWidthPct, 4) * 1.35"));
  assert.ok(markup.includes("추가/수정/삭제 비활성화"));
  assert.equal((markup.match(/formula-list__item is-active/g) ?? []).length, 1);
  assert.equal(/<(input|textarea|select)\b/.test(markup), false);
  assert.equal(markup.includes("contenteditable"), false);
});

test("외부에서 공식 배열을 넘겨도 패널은 내장된 기본 공식만 표시한다", () => {
  const markup = getTradingFormulaPanelMarkup({
    formulas: [
      {
        id: "custom-formula",
        name: "사용자 정의 공식",
        description: "표시되면 안 된다",
        detection: {
          timeframe: "1m",
          symbols: ["BTCUSDT", "ETHUSDT"],
          signalType: "trend-continuation",
          maxAlertLatencyMs: 3000,
          conditions: [],
        },
      },
    ],
    selectedFormulaId: "custom-formula",
  });

  assert.equal(markup.includes("사용자 정의 공식"), false);
  assert.ok(markup.includes(TRADING_FORMULAS[0].name));
  assert.equal((markup.match(/data-formula-id=/g) ?? []).length, 3);
});

test("알 수 없는 선택 ID가 들어오면 첫 번째 공식 상세 보기로 안전하게 폴백한다", () => {
  const markup = getTradingFormulaPanelMarkup({
    selectedFormulaId: "unknown-formula",
  });

  assert.ok(markup.includes(TRADING_FORMULAS[0].name));
  assert.ok(markup.includes(TRADING_FORMULAS[0].description));
});
