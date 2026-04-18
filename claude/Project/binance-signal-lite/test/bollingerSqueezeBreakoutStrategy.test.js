import test from "node:test";
import assert from "node:assert/strict";

import {
  detectBollingerSqueezeBreakoutSignal,
  getRequiredBollingerSqueezeCandles,
} from "../src/features/signals/bollingerSqueezeBreakoutStrategy.js";

function createClosedCandle(index, { open, high, low, close, volume = 100 }) {
  const openTime = 1712830200000 + index * 300_000;

  return {
    openTime,
    closeTime: openTime + 299_999,
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
  period: 5,
  standardDeviationMultiplier: 2,
  squeezeLookback: 3,
  volumeLookback: 3,
  maxSqueezeBandwidthPercent: 0.006,
  minBandwidthExpansionRatio: 1.4,
  breakoutCloseBufferPercent: 0.001,
  minVolumeMultiplier: 1.5,
  minBodyToRangeRatio: 0.45,
  stopBufferPercent: 0.001,
  targetRiskRewardRatio: 1.8,
};

function createSqueezeCandles(overrides = {}) {
  return [
    createClosedCandle(0, { open: 100, high: 100.3, low: 99.8, close: 100.05 }),
    createClosedCandle(1, { open: 100.05, high: 100.25, low: 99.9, close: 100.1 }),
    createClosedCandle(2, { open: 100.1, high: 100.22, low: 99.92, close: 100.02 }),
    createClosedCandle(3, { open: 100.02, high: 100.2, low: 99.95, close: 100.08 }),
    createClosedCandle(4, { open: 100.08, high: 100.18, low: 99.94, close: 100.04 }),
    createClosedCandle(5, { open: 100.03, high: 100.16, low: 99.97, close: 100.09, volume: 100 }),
    createClosedCandle(6, { open: 100.07, high: 100.14, low: 99.99, close: 100.05, volume: 98 }),
    createClosedCandle(7, { open: 100.05, high: 100.18, low: 100, close: 100.11, volume: 102 }),
    createClosedCandle(8, {
      open: 100.08,
      high: 101.3,
      low: 100.04,
      close: 101.18,
      volume: 220,
      ...overrides.breakout,
    }),
  ];
}

test("getRequiredBollingerSqueezeCandles returns period plus squeeze baseline depth", () => {
  assert.equal(getRequiredBollingerSqueezeCandles(strategyOptions), 8);
});

test("detectBollingerSqueezeBreakoutSignal confirms bullish squeeze expansion breakout", () => {
  const signal = detectBollingerSqueezeBreakoutSignal(
    createSqueezeCandles(),
    strategyOptions,
  );

  assert.equal(signal.direction, "bullish");
  assert.equal(signal.formulaId, "bollinger-squeeze-breakout-5m");
  assert.equal(signal.entryPrice, 101.18);
  assert.ok(signal.triggerPrice < signal.entryPrice);
  assert.ok(signal.bandwidthExpansionRatio > 10);
  assert.ok(signal.volumeRatio > 2);
  assert.ok(signal.stopLoss < signal.entryPrice);
  assert.ok(signal.takeProfit > signal.entryPrice);
  assert.match(signal.explanation, /볼린저 상단 밴드/);
});

test("detectBollingerSqueezeBreakoutSignal rejects breakout candles without enough volume expansion", () => {
  const signal = detectBollingerSqueezeBreakoutSignal(
    createSqueezeCandles({
      breakout: {
        volume: 120,
      },
    }),
    strategyOptions,
  );

  assert.equal(signal, null);
});
