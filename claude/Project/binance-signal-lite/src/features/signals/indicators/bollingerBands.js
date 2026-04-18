function assertPeriod(period) {
  if (!Number.isInteger(period) || period <= 1) {
    throw new Error("Bollinger period must be an integer greater than 1");
  }
}

function assertStandardDeviationMultiplier(multiplier) {
  if (typeof multiplier !== "number" || !Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error(
      "Bollinger standard deviation multiplier must be a positive number",
    );
  }
}

function normalizeValues(values) {
  if (!Array.isArray(values)) {
    throw new Error("Bollinger values must be an array");
  }

  return values.map((value) => Number(value));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateStandardDeviation(values, mean) {
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function calculateBollingerBandSeries(
  values,
  period,
  standardDeviationMultiplier = 2,
) {
  assertPeriod(period);
  assertStandardDeviationMultiplier(standardDeviationMultiplier);

  const normalizedValues = normalizeValues(values);
  const series = Array.from({ length: normalizedValues.length }, () => null);

  if (normalizedValues.length < period) {
    return series;
  }

  for (let index = period - 1; index < normalizedValues.length; index += 1) {
    const window = normalizedValues.slice(index - period + 1, index + 1);
    const middle = average(window);
    const standardDeviation = calculateStandardDeviation(window, middle);
    const distance = standardDeviation * standardDeviationMultiplier;
    const upper = middle + distance;
    const lower = middle - distance;
    const bandwidth = upper - lower;

    series[index] = {
      middle,
      upper,
      lower,
      standardDeviation,
      bandwidth,
      bandwidthPercent: middle !== 0 ? bandwidth / middle : 0,
    };
  }

  return series;
}
