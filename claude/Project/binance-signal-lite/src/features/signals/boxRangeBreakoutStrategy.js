export const BOX_RANGE_BREAKOUT_STRATEGY_ID = "box-range-breakout-volume";
export const BOX_RANGE_BREAKOUT_FORMULA_ID = "opening-range-breakout-1m";
export const BOX_RANGE_BREAKOUT_SIGNAL_TYPE = "momentum-breakout";

export const DEFAULT_BOX_RANGE_BREAKOUT_OPTIONS = Object.freeze({
  rangeLookback: 12,
  volumeLookback: 6,
  maxRangePercent: 0.03,
  breakoutBufferPercent: 0.001,
  minVolumeMultiplier: 1.8,
  minBodyToRangeRatio: 0.35,
  stopBufferPercent: 0.001,
  targetRiskRewardRatio: 1.8,
});

function getClosedCandles(candles) {
  return candles
    .filter((candle) => candle.isClosed !== false)
    .slice()
    .sort((left, right) => left.openTime - right.openTime);
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getPricePrecision(price) {
  if (price >= 10_000) {
    return 2;
  }

  if (price >= 100) {
    return 3;
  }

  if (price >= 1) {
    return 4;
  }

  return 6;
}

function formatPrice(price) {
  return price.toFixed(getPricePrecision(price));
}

function createExplanation({
  direction,
  boxHigh,
  boxLow,
  entryPrice,
  stopLoss,
  takeProfit,
  breakoutPrice,
  volumeRatio,
  rangePercent,
}) {
  const boundaryLabel = direction === "bullish" ? "상단" : "하단";
  const boundaryPrice = direction === "bullish" ? boxHigh : boxLow;
  const directionLabel = direction === "bullish" ? "상방 돌파" : "하방 이탈";

  return [
    `박스권 ${boundaryLabel} ${formatPrice(boundaryPrice)} ${directionLabel}`,
    `종가 ${formatPrice(breakoutPrice)}`,
    `진입 ${formatPrice(entryPrice)} · 손절 ${formatPrice(stopLoss)} · 목표 ${formatPrice(takeProfit)}`,
    `거래량 ${volumeRatio.toFixed(2)}배`,
    `박스 폭 ${(rangePercent * 100).toFixed(2)}%`,
  ].join(" · ");
}

export function detectBoxRangeBreakoutSignal(candles, options = {}) {
  const settings = {
    ...DEFAULT_BOX_RANGE_BREAKOUT_OPTIONS,
    ...options,
  };
  const closedCandles = getClosedCandles(candles);

  if (closedCandles.length < settings.rangeLookback + 1) {
    return null;
  }

  const breakoutCandle = closedCandles.at(-1);
  const boxCandles = closedCandles.slice(-(settings.rangeLookback + 1), -1);

  if (boxCandles.length < settings.rangeLookback) {
    return null;
  }

  const boxHigh = Math.max(...boxCandles.map((candle) => candle.high));
  const boxLow = Math.min(...boxCandles.map((candle) => candle.low));
  const boxMid = (boxHigh + boxLow) / 2;

  if (boxMid <= 0) {
    return null;
  }

  const rangePercent = (boxHigh - boxLow) / boxMid;

  if (rangePercent > settings.maxRangePercent) {
    return null;
  }

  const baselineCandles = boxCandles.slice(-settings.volumeLookback);

  if (baselineCandles.length < settings.volumeLookback) {
    return null;
  }

  const baselineVolume = average(
    baselineCandles.map((candle) => Number(candle.volume ?? 0)),
  );

  if (baselineVolume <= 0) {
    return null;
  }

  const breakoutVolume = Number(breakoutCandle.volume ?? 0);
  const volumeRatio = breakoutVolume / baselineVolume;

  if (volumeRatio < settings.minVolumeMultiplier) {
    return null;
  }

  const breakoutBodySize = Math.abs(breakoutCandle.close - breakoutCandle.open);
  const requiredBodySize =
    (boxHigh - boxLow) * settings.minBodyToRangeRatio;

  if (breakoutBodySize < requiredBodySize) {
    return null;
  }

  const brokeUp =
    breakoutCandle.open <= boxHigh &&
    breakoutCandle.close > boxHigh * (1 + settings.breakoutBufferPercent);
  const brokeDown =
    breakoutCandle.open >= boxLow &&
    breakoutCandle.close < boxLow * (1 - settings.breakoutBufferPercent);

  if (!brokeUp && !brokeDown) {
    return null;
  }

  const direction = brokeUp ? "bullish" : "bearish";
  const breakoutBoundary = brokeUp ? boxHigh : boxLow;
  const entryPrice = breakoutCandle.close;
  const stopLoss = brokeUp
    ? boxLow * (1 - settings.stopBufferPercent)
    : boxHigh * (1 + settings.stopBufferPercent);
  const riskAmount = brokeUp
    ? entryPrice - stopLoss
    : stopLoss - entryPrice;

  if (riskAmount <= 0) {
    return null;
  }

  const takeProfit = brokeUp
    ? entryPrice + riskAmount * settings.targetRiskRewardRatio
    : entryPrice - riskAmount * settings.targetRiskRewardRatio;
  const breakoutDistancePercent = brokeUp
    ? (breakoutCandle.close - breakoutBoundary) / boxMid
    : (breakoutBoundary - breakoutCandle.close) / boxMid;
  const confidence = clamp(
    Math.round(
      55 +
        ((volumeRatio - settings.minVolumeMultiplier) /
          settings.minVolumeMultiplier) *
          20 +
        Math.min(breakoutDistancePercent * 1_200, 20),
    ),
    1,
    99,
  );

  const signal = {
    strategyId: BOX_RANGE_BREAKOUT_STRATEGY_ID,
    formulaId: BOX_RANGE_BREAKOUT_FORMULA_ID,
    signalType: BOX_RANGE_BREAKOUT_SIGNAL_TYPE,
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    targetRiskRewardRatio: settings.targetRiskRewardRatio,
    riskAmount,
    riskPercent: riskAmount / entryPrice,
    rewardAmount: Math.abs(takeProfit - entryPrice),
    rewardPercent: Math.abs(takeProfit - entryPrice) / entryPrice,
    breakoutBoundary,
    breakoutPrice: breakoutCandle.close,
    boxHigh,
    boxLow,
    rangePercent,
    volumeRatio,
    baselineVolume,
    breakoutVolume,
    breakoutDistancePercent,
    confidence,
    boxLength: boxCandles.length,
    breakoutCandle: { ...breakoutCandle },
  };

  return {
    ...signal,
    explanation: createExplanation(signal),
  };
}
