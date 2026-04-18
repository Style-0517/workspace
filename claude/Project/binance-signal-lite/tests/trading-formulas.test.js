import test from "node:test";
import assert from "node:assert/strict";

import {
  TRADING_FORMULAS,
  TRADING_FORMULA_BY_ID,
  TRADING_FORMULA_IDS,
  getTradingFormulaById
} from "../src/features/trading-formulas/trading-formulas.js";
import { MARKET_SYMBOLS } from "../src/config/marketCatalog.js";

const EXPECTED_SYMBOLS = MARKET_SYMBOLS;

test("정확히 3개의 고정 트레이딩 공식이 등록되어 있다", () => {
  assert.equal(TRADING_FORMULAS.length, 3);
  assert.deepEqual(TRADING_FORMULA_IDS, [
    "ema-pullback-reclaim-1m",
    "opening-range-breakout-1m",
    "bollinger-squeeze-breakout-5m"
  ]);
});

test("각 공식은 식별자, 이름, 설명, 감지 조건을 모두 가진다", () => {
  for (const formula of TRADING_FORMULAS) {
    assert.ok(formula.id);
    assert.ok(formula.name);
    assert.ok(formula.description);
    assert.ok(formula.detection);
    assert.match(formula.detection.timeframe, /^(1m|5m)$/);
    assert.deepEqual(formula.detection.symbols, EXPECTED_SYMBOLS);
    assert.equal(formula.detection.maxAlertLatencyMs, 3000);
    assert.ok(Array.isArray(formula.detection.conditions));
    assert.ok(formula.detection.conditions.length >= 3);

    for (const condition of formula.detection.conditions) {
      assert.ok(condition.id);
      assert.ok(condition.name);
      assert.ok(condition.expression);
      assert.ok(condition.rationale);
      assert.ok(Array.isArray(condition.indicatorRefs));
      assert.ok(condition.indicatorRefs.length >= 1);
    }
  }
});

test("ID 기준 조회 헬퍼와 맵으로 공식 데이터를 참조할 수 있다", () => {
  for (const formula of TRADING_FORMULAS) {
    assert.equal(getTradingFormulaById(formula.id), formula);
    assert.equal(TRADING_FORMULA_BY_ID[formula.id], formula);
  }

  assert.equal(getTradingFormulaById("unknown-formula"), null);
});

test("공식 데이터는 런타임에서 수정되지 않도록 고정되어 있다", () => {
  assert.throws(() => {
    TRADING_FORMULAS.push({});
  }, TypeError);

  assert.throws(() => {
    TRADING_FORMULAS[0].detection.conditions[0].expression = "mutated";
  }, TypeError);
});
