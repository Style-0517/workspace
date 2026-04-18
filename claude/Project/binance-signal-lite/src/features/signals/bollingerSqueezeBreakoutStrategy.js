import { calculateBollingerBandSeries } from "./indicators/bollingerBands.js";

export const BOLLINGER_SQUEEZE_BREAKOUT_STRATEGY_ID =
  "bollinger-squeeze-expansion-breakout";
export const BOLLINGER_SQUEEZE_FORMULA_ID = "bollinger-squeeze-breakout-5m";
export const BOLLINGER_SQUEEZE_SIGNAL_TYPE = "volatility-breakout";

export const DEFAULT_BOLLINGER_SQUEEZE_OPTIONS = Object.freeze({
  period: 20,
  standardDeviationMultiplier: 2,
  squeezeLookback: 4,
  volumeLookback: 5,
  maxSqueezeBandwidthPercent: 0.035,
  minBandwidthExpansionRatio: 1.35,
  breakoutCloseBufferPercent: 0.001,
  minVolumeMultiplier: 1.5,
  minBodyToRangeRatio: 0.5,
  stopBufferPercent: 0.0015,
  targetRiskRewardRatio: 1.8,
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function calculateBodyToRangeRatio(candle) {
  const candleRange = candle.high - candle.low;

  if (candleRange <= 0) {
    return 0;
  }

  return Math.abs(candle.close - candle.open) / candleRange;
}

function calculateDirectionalCloseStrength(candle, direction) {
  const candleRange = candle.high - candle.low;

  if (candleRange <= 0) {
    return 0;
  }

  return direction === "bullish"
    ? (candle.close - candle.low) / candleRange
    : (candle.high - candle.close) / candleRange;
}

function annotateCandlesWithBollingerBands(candles, settings) {
  const closes = candles.map(({ close }) => Number(close));
  const bands = calculateBollingerBandSeries(
    closes,
    settings.period,
    settings.standardDeviationMultiplier,
  );

  return candles.map((candle, index) => ({
    ...candle,
    bollingerBands: bands[index],
  }));
}

function getSignalLevels({
  direction,
  breakoutCandle,
  squeezeCandles,
  previousBands,
  settings,
}) {
  const entryPrice = breakoutCandle.close;

  if (direction === "bullish") {
    const stopReference = Math.min(
      breakoutCandle.low,
      Math.min(...squeezeCandles.map(({ low }) => low)),
      previousBands.middle,
    );
    const stopLoss = stopReference * (1 - settings.stopBufferPercent);
    const riskAmount = entryPrice - stopLoss;

    if (riskAmount <= 0) {
      return null;
    }

    const takeProfit =
      entryPrice + riskAmount * settings.targetRiskRewardRatio;

    return {
      entryPrice,
      stopLoss,
      takeProfit,
      riskAmount,
      rewardAmount: takeProfit - entryPrice,
      riskPercent: riskAmount / entryPrice,
      rewardPercent: (takeProfit - entryPrice) / entryPrice,
    };
  }

  const stopReference = Math.max(
    breakoutCandle.high,
    Math.max(...squeezeCandles.map(({ high }) => high)),
    previousBands.middle,
  );
  const stopLoss = stopReference * (1 + settings.stopBufferPercent);
  const riskAmount = stopLoss - entryPrice;

  if (riskAmount <= 0) {
    return null;
  }

  const takeProfit =
    entryPrice - riskAmount * settings.targetRiskRewardRatio;

  if (takeProfit <= 0) {
    return null;
  }

  return {
    entryPrice,
    stopLoss,
    takeProfit,
    riskAmount,
    rewardAmount: entryPrice - takeProfit,
    riskPercent: riskAmount / entryPrice,
    rewardPercent: (entryPrice - takeProfit) / entryPrice,
  };
}

function createExplanation({
  direction,
  previousBands,
  breakoutCandle,
  averageSqueezeBandwidthPercent,
  breakoutBandwidthPercent,
  bandwidthExpansionRatio,
  volumeRatio,
  stopLoss,
  takeProfit,
}) {
  const bandLabel = direction === "bullish" ? "상단 밴드" : "하단 밴드";
  const breakoutBand =
    direction === "bullish" ? previousBands.upper : previousBands.lower;
  const breakoutLabel = direction === "bullish" ? "상방 돌파" : "하방 이탈";

  return [
    `볼린저 ${bandLabel} ${formatPrice(breakoutBand)} ${breakoutLabel}`,
    `종가 ${formatPrice(breakoutCandle.close)}`,
    `밴드폭 ${(averageSqueezeBandwidthPercent * 100).toFixed(2)}% → ${(breakoutBandwidthPercent * 100).toFixed(2)}% (${bandwidthExpansionRatio.toFixed(2)}배)`,
    `거래량 ${volumeRatio.toFixed(2)}배`,
    `손절 ${formatPrice(stopLoss)} · 목표 ${formatPrice(takeProfit)}`,
  ].join(" · ");
}

export function getRequiredBollingerSqueezeCandles(options = {}) {
  const settings = {
    ...DEFAULT_BOLLINGER_SQUEEZE_OPTIONS,
    ...options,
  };

  return settings.period + Math.max(settings.squeezeLookback, settings.volumeLookback);
}

export function detectBollingerSqueezeBreakoutSignal(
  candles,
  options = {},
) {
  const settings = {
    ...DEFAULT_BOLLINGER_SQUEEZE_OPTIONS,
    ...options,
  };
  const closedCandles = getClosedCandles(candles);
  const requiredCandles = getRequiredBollingerSqueezeCandles(settings);

  if (closedCandles.length < requiredCandles) {
    return null;
  }

  const annotatedCandles = annotateCandlesWithBollingerBands(
    closedCandles,
    settings,
  );
  const breakoutCandle = annotatedCandles.at(-1);
  const squeezeCandles = annotatedCandles.slice(-(settings.squeezeLookback + 1), -1);
  const previousCandle = squeezeCandles.at(-1);

  if (!breakoutCandle?.bollingerBands || !previousCandle?.bollingerBands) {
    return null;
  }

  if (
    squeezeCandles.length < settings.squeezeLookback ||
    squeezeCandles.some(({ bollingerBands }) => bollingerBands == null)
  ) {
    return null;
  }

  const squeezeBandwidths = squeezeCandles.map(
    ({ bollingerBands }) => bollingerBands.bandwidthPercent,
  );
  const averageSqueezeBandwidthPercent = average(squeezeBandwidths);
  const maximumSqueezeBandwidthPercent = Math.max(...squeezeBandwidths);

  if (
    averageSqueezeBandwidthPercent <= 0 ||
    maximumSqueezeBandwidthPercent > settings.maxSqueezeBandwidthPercent
  ) {
    return null;
  }

  const breakoutBandwidthPercent = breakoutCandle.bollingerBands.bandwidthPercent;
  const bandwidthExpansionRatio =
    breakoutBandwidthPercent / averageSqueezeBandwidthPercent;

  if (bandwidthExpansionRatio < settings.minBandwidthExpansionRatio) {
    return null;
  }

  const baselineCandles = closedCandles.slice(-(settings.volumeLookback + 1), -1);

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

  const bodyToRangeRatio = calculateBodyToRangeRatio(breakoutCandle);

  if (bodyToRangeRatio < settings.minBodyToRangeRatio) {
    return null;
  }

  const previousBands = previousCandle.bollingerBands;
  const breakoutBufferPercent = settings.breakoutCloseBufferPercent;
  const openedInsideUpperBand =
    breakoutCandle.open <= previousBands.upper * (1 + breakoutBufferPercent);
  const openedInsideLowerBand =
    breakoutCandle.open >= previousBands.lower * (1 - breakoutBufferPercent);
  const brokeUp =
    breakoutCandle.close > breakoutCandle.open &&
    previousCandle.close <= previousBands.upper &&
    openedInsideUpperBand &&
    breakoutCandle.close > previousBands.upper * (1 + breakoutBufferPercent);
  const brokeDown =
    breakoutCandle.close < breakoutCandle.open &&
    previousCandle.close >= previousBands.lower &&
    openedInsideLowerBand &&
    breakoutCandle.close < previousBands.lower * (1 - breakoutBufferPercent);

  if (!brokeUp && !brokeDown) {
    return null;
  }

  const direction = brokeUp ? "bullish" : "bearish";
  const closeStrength = calculateDirectionalCloseStrength(
    breakoutCandle,
    direction,
  );
  const triggerPrice = brokeUp ? previousBands.upper : previousBands.lower;
  const breakoutDistancePercent =
    previousBands.middle > 0
      ? brokeUp
        ? (breakoutCandle.close - previousBands.upper) / previousBands.middle
        : (previousBands.lower - breakoutCandle.close) / previousBands.middle
      : 0;
  const levels = getSignalLevels({
    direction,
    breakoutCandle,
    squeezeCandles,
    previousBands,
    settings,
  });

  if (!levels) {
    return null;
  }

  const confidence = clamp(
    Math.round(
      55 +
        Math.min((volumeRatio / settings.minVolumeMultiplier) * 6, 14) +
        Math.min(
          (bandwidthExpansionRatio / settings.minBandwidthExpansionRatio) * 7,
          16,
        ) +
        Math.max(0, closeStrength - 0.55) * 24 +
        Math.min(breakoutDistancePercent * 1_200, 12),
    ),
    1,
    99,
  );

  const signal = {
    strategyId: BOLLINGER_SQUEEZE_BREAKOUT_STRATEGY_ID,
    formulaId: BOLLINGER_SQUEEZE_FORMULA_ID,
    signalType: BOLLINGER_SQUEEZE_SIGNAL_TYPE,
    direction,
    period: settings.period,
    standardDeviationMultiplier: settings.standardDeviationMultiplier,
    triggerPrice,
    squeezeHigh: Math.max(...squeezeCandles.map(({ high }) => high)),
    squeezeLow: Math.min(...squeezeCandles.map(({ low }) => low)),
    averageSqueezeBandwidthPercent,
    maximumSqueezeBandwidthPercent,
    breakoutBandwidthPercent,
    bandwidthExpansionRatio,
    baselineVolume,
    breakoutVolume,
    volumeRatio,
    bodyToRangeRatio,
    closeStrength,
    breakoutDistancePercent,
    targetRiskRewardRatio: settings.targetRiskRewardRatio,
    confidence,
    breakoutCandle: { ...breakoutCandle },
    previousCandle: { ...previousCandle },
    ...levels,
  };

  return {
    ...signal,
    explanation: createExplanation({
      direction,
      previousBands,
      breakoutCandle,
      averageSqueezeBandwidthPercent,
      breakoutBandwidthPercent,
      bandwidthExpansionRatio,
      volumeRatio,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,
    }),
  };
}
