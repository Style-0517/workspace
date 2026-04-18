import test from "node:test";
import assert from "node:assert/strict";

import { detectBoxRangeBreakoutSignal } from "../src/features/signals/boxRangeBreakoutStrategy.js";

function createClosedCandle(index, { open, high, low, close, volume }) {
  const openTime = 1712830200000 + index * 60_000;

  return {
    openTime,
    closeTime: openTime + 59_999,
    open,
    high,
    low,
    close,
    volume,
    quoteVolume: volume * close,
    isClosed: true,
  };
}

test("detectBoxRangeBreakoutSignal confirms bullish breakout with volume expansion", () => {
  const signal = detectBoxRangeBreakoutSignal(
    [
      createClosedCandle(0, {
        open: 99.95,
        high: 100.2,
        low: 99.8,
        close: 100.1,
        volume: 100,
      }),
      createClosedCandle(1, {
        open: 100.05,
        high: 100.25,
        low: 99.9,
        close: 100.15,
        volume: 102,
      }),
      createClosedCandle(2, {
        open: 100.1,
        high: 100.3,
        low: 99.92,
        close: 100.02,
        volume: 98,
      }),
      createClosedCandle(3, {
        open: 99.98,
        high: 100.28,
        low: 99.85,
        close: 100.2,
        volume: 105,
      }),
      createClosedCandle(4, {
        open: 100.18,
        high: 101.45,
        low: 100.1,
        close: 101.35,
        volume: 230,
      }),
    ],
    {
      rangeLookback: 4,
      volumeLookback: 3,
      maxRangePercent: 0.02,
      breakoutBufferPercent: 0.001,
      minVolumeMultiplier: 1.8,
      minBodyToRangeRatio: 0.3,
    },
  );

  assert.equal(signal.direction, "bullish");
  assert.equal(signal.formulaId, "opening-range-breakout-1m");
  assert.equal(signal.entryPrice, 101.35);
  assert.ok(signal.stopLoss < signal.entryPrice);
  assert.ok(signal.takeProfit > signal.entryPrice);
  assert.equal(signal.breakoutPrice, 101.35);
  assert.ok(signal.volumeRatio > 2);
  assert.match(signal.explanation, /손절/);
  assert.match(signal.explanation, /거래량/);
});

test("detectBoxRangeBreakoutSignal rejects breakouts without enough volume", () => {
  const signal = detectBoxRangeBreakoutSignal(
    [
      createClosedCandle(0, {
        open: 99.95,
        high: 100.2,
        low: 99.8,
        close: 100.1,
        volume: 100,
      }),
      createClosedCandle(1, {
        open: 100.05,
        high: 100.25,
        low: 99.9,
        close: 100.15,
        volume: 102,
      }),
      createClosedCandle(2, {
        open: 100.1,
        high: 100.3,
        low: 99.92,
        close: 100.02,
        volume: 98,
      }),
      createClosedCandle(3, {
        open: 99.98,
        high: 100.28,
        low: 99.85,
        close: 100.2,
        volume: 105,
      }),
      createClosedCandle(4, {
        open: 100.18,
        high: 101.45,
        low: 100.1,
        close: 101.35,
        volume: 130,
      }),
    ],
    {
      rangeLookback: 4,
      volumeLookback: 3,
      maxRangePercent: 0.02,
      breakoutBufferPercent: 0.001,
      minVolumeMultiplier: 1.8,
      minBodyToRangeRatio: 0.3,
    },
  );

  assert.equal(signal, null);
});
