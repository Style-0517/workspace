import { calculateExponentialMovingAverageSeries } from "./indicators/exponentialMovingAverage.js";

export const EMA_PULLBACK_TREND_STRATEGY_ID =
  "ema-pullback-trend-continuation";
export const EMA_PULLBACK_FORMULA_ID = "ema-pullback-reclaim-1m";
export const EMA_PULLBACK_SIGNAL_TYPE = "trend-continuation";

export const DEFAULT_EMA_PULLBACK_OPTIONS = Object.freeze({
  fastPeriod: 9,
  slowPeriod: 21,
  pullbackTolerancePercent: 0.0015,
  maxSlowEmaOvershootPercent: 0.003,
  reclaimBufferPercent: 0.0005,
  breakoutBufferPercent: 0,
  minCloseStrength: 0.55,
  minEmaGapPercent: 0.0008,
  stopBufferPercent: 0.001,
  targetRiskRewardRatio: 1.8,
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getClosedCandles(candles) {
  return candles
    .filter((candle) => candle.isClosed !== false)
    .slice()
    .sort((left, right) => left.openTime - right.openTime);
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

function calculateCloseStrength(candle) {
  const range = candle.high - candle.low;

  if (range <= 0) {
    return 0;
  }

  return (candle.close - candle.low) / range;
}

function annotateCandlesWithEma(candles, settings) {
  const closes = candles.map(({ close }) => Number(close));
  const fastSeries = calculateExponentialMovingAverageSeries(
    closes,
    settings.fastPeriod,
  );
  const slowSeries = calculateExponentialMovingAverageSeries(
    closes,
    settings.slowPeriod,
  );

  return candles.map((candle, index) => ({
    ...candle,
    fastEma: fastSeries[index],
    slowEma: slowSeries[index],
  }));
}

function createExplanation({
  settings,
  previousCandle,
  currentCandle,
  entryPrice,
  stopLoss,
  takeProfit,
}) {
  return [
    `${settings.fastPeriod}EMA ${formatPrice(currentCandle.fastEma)} > ${settings.slowPeriod}EMA ${formatPrice(currentCandle.slowEma)}`,
    `직전 저가 ${formatPrice(previousCandle.low)}가 ${settings.fastPeriod}EMA 눌림 확인`,
    `종가 ${formatPrice(currentCandle.close)}가 ${settings.fastPeriod}EMA와 직전 고가 ${formatPrice(previousCandle.high)} 회복`,
    `손절 ${formatPrice(stopLoss)} · 목표 ${formatPrice(takeProfit)}`,
  ].join(" · ");
}

export function getRequiredEmaPullbackCandles(options = {}) {
  const settings = {
    ...DEFAULT_EMA_PULLBACK_OPTIONS,
    ...options,
  };

  return settings.slowPeriod + 2;
}

export function detectEmaPullbackTrendContinuationSignal(
  candles,
  options = {},
) {
  const settings = {
    ...DEFAULT_EMA_PULLBACK_OPTIONS,
    ...options,
  };
  const closedCandles = getClosedCandles(candles);
  const requiredCandles = getRequiredEmaPullbackCandles(settings);

  if (closedCandles.length < requiredCandles) {
    return null;
  }

  if (settings.fastPeriod >= settings.slowPeriod) {
    throw new Error("fastPeriod must be smaller than slowPeriod");
  }

  const annotatedCandles = annotateCandlesWithEma(closedCandles, settings);
  const currentCandle = annotatedCandles.at(-1);
  const previousCandle = annotatedCandles.at(-2);

  if (
    !currentCandle ||
    !previousCandle ||
    currentCandle.fastEma == null ||
    currentCandle.slowEma == null ||
    previousCandle.fastEma == null ||
    previousCandle.slowEma == null
  ) {
    return null;
  }

  if (currentCandle.close <= currentCandle.open) {
    return null;
  }

  if (
    currentCandle.fastEma <= currentCandle.slowEma ||
    previousCandle.fastEma <= previousCandle.slowEma
  ) {
    return null;
  }

  const emaGapPercent =
    (currentCandle.fastEma - currentCandle.slowEma) / currentCandle.slowEma;

  if (emaGapPercent < settings.minEmaGapPercent) {
    return null;
  }

  const slowFloor =
    previousCandle.slowEma * (1 - settings.maxSlowEmaOvershootPercent);

  if (previousCandle.low < slowFloor || previousCandle.close < slowFloor) {
    return null;
  }

  const touchedFastEma =
    previousCandle.low <=
    previousCandle.fastEma * (1 + settings.pullbackTolerancePercent);

  if (!touchedFastEma) {
    return null;
  }

  const reclaimedFastEma =
    currentCandle.close >
    currentCandle.fastEma * (1 + settings.reclaimBufferPercent);
  const reclaimedPreviousHigh =
    currentCandle.close >
    previousCandle.high * (1 + settings.breakoutBufferPercent);

  if (!reclaimedFastEma || !reclaimedPreviousHigh) {
    return null;
  }

  const closeStrength = calculateCloseStrength(currentCandle);

  if (closeStrength < settings.minCloseStrength) {
    return null;
  }

  const stopReference = Math.min(previousCandle.low, currentCandle.low);
  const stopLoss = stopReference * (1 - settings.stopBufferPercent);
  const entryPrice = currentCandle.close;
  const riskAmount = entryPrice - stopLoss;

  if (riskAmount <= 0) {
    return null;
  }

  const takeProfit =
    entryPrice + riskAmount * settings.targetRiskRewardRatio;
  const reclaimReference = Math.max(currentCandle.fastEma, previousCandle.high);
  const reclaimDistancePercent =
    reclaimReference > 0
      ? (entryPrice - reclaimReference) / reclaimReference
      : 0;
  const confidence = clamp(
    Math.round(
      55 +
        Math.min((emaGapPercent / settings.minEmaGapPercent) * 8, 16) +
        Math.max(0, closeStrength - settings.minCloseStrength) * 30 +
        Math.min(reclaimDistancePercent * 1_000, 12),
    ),
    1,
    99,
  );

  const signal = {
    strategyId: EMA_PULLBACK_TREND_STRATEGY_ID,
    formulaId: EMA_PULLBACK_FORMULA_ID,
    signalType: EMA_PULLBACK_SIGNAL_TYPE,
    direction: "bullish",
    fastPeriod: settings.fastPeriod,
    slowPeriod: settings.slowPeriod,
    entryPrice,
    triggerPrice: previousCandle.high,
    stopLoss,
    takeProfit,
    targetRiskRewardRatio: settings.targetRiskRewardRatio,
    riskAmount,
    riskPercent: riskAmount / entryPrice,
    rewardAmount: takeProfit - entryPrice,
    rewardPercent: (takeProfit - entryPrice) / entryPrice,
    closeStrength,
    emaGapPercent,
    reclaimDistancePercent,
    confidence,
    previousCandle: { ...previousCandle },
    confirmationCandle: { ...currentCandle },
  };

  return {
    ...signal,
    explanation: createExplanation({
      settings,
      previousCandle,
      currentCandle,
      entryPrice,
      stopLoss,
      takeProfit,
    }),
  };
}
