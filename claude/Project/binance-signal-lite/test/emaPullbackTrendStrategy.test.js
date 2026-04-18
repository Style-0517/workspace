import test from "node:test";
import assert from "node:assert/strict";

import { detectEmaPullbackTrendContinuationSignal } from "../src/features/signals/emaPullbackTrendStrategy.js";

function createClosedCandle(index, { open, high, low, close, volume = 100 }) {
  const openTime = 1712830200000 + index * 180_000;

  return {
    openTime,
    closeTime: openTime + 179_999,
    open,
    high,
    low,
    close,
    volume,
    quoteVolume: volume * close,
    isClosed: true,
  };
}

const strategyOptions = {
  fastPeriod: 3,
  slowPeriod: 5,
  pullbackTolerancePercent: 0.0015,
  maxSlowEmaOvershootPercent: 0.003,
  reclaimBufferPercent: 0.0005,
  minCloseStrength: 0.55,
  minEmaGapPercent: 0.004,
  stopBufferPercent: 0.001,
  targetRiskRewardRatio: 1.8,
};

function createTrendCandles(overrides = {}) {
  return [
    createClosedCandle(0, { open: 99.8, high: 100.2, low: 99.7, close: 100 }),
    createClosedCandle(1, { open: 100.2, high: 101.2, low: 100.1, close: 101 }),
    createClosedCandle(2, { open: 101.1, high: 102.2, low: 101, close: 102 }),
    createClosedCandle(3, { open: 102.2, high: 103.3, low: 102.1, close: 103 }),
    createClosedCandle(4, { open: 103.2, high: 104.4, low: 103.1, close: 104 }),
    createClosedCandle(5, { open: 104.1, high: 104.5, low: 103.8, close: 104.3 }),
    createClosedCandle(6, {
      open: 104.15,
      high: 104.45,
      low: 103.45,
      close: 103.6,
      ...overrides.previous,
    }),
    createClosedCandle(7, {
      open: 103.7,
      high: 105,
      low: 103.6,
      close: 104.9,
      ...overrides.current,
    }),
  ];
}

test("detectEmaPullbackTrendContinuationSignal confirms bullish EMA reclaim", () => {
  const signal = detectEmaPullbackTrendContinuationSignal(
    createTrendCandles(),
    strategyOptions,
  );

  assert.equal(signal.direction, "bullish");
  assert.equal(signal.formulaId, "ema-pullback-reclaim-1m");
  assert.equal(signal.entryPrice, 104.9);
  assert.equal(signal.triggerPrice, 104.45);
  assert.ok(signal.stopLoss < signal.entryPrice);
  assert.ok(signal.takeProfit > signal.entryPrice);
  assert.ok(signal.emaGapPercent > 0.004);
  assert.match(signal.explanation, /손절/);
});

test("detectEmaPullbackTrendContinuationSignal rejects candles without fast EMA pullback", () => {
  const signal = detectEmaPullbackTrendContinuationSignal(
    createTrendCandles({
      previous: {
        open: 104.2,
        low: 104.12,
        close: 104.25,
      },
    }),
    strategyOptions,
  );

  assert.equal(signal, null);
});

test("detectEmaPullbackTrendContinuationSignal rejects candles that do not reclaim previous high", () => {
  const signal = detectEmaPullbackTrendContinuationSignal(
    createTrendCandles({
      current: {
        high: 104.5,
        close: 104.3,
      },
    }),
    strategyOptions,
  );

  assert.equal(signal, null);
});
