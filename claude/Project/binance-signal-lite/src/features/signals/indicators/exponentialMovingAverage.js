function assertPeriod(period) {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error("EMA period must be a positive integer");
  }
}

function normalizeValues(values) {
  if (!Array.isArray(values)) {
    throw new Error("EMA values must be an array");
  }

  return values.map((value) => Number(value));
}

export function calculateExponentialMovingAverageSeries(values, period) {
  assertPeriod(period);
  const normalizedValues = normalizeValues(values);
  const series = Array.from({ length: normalizedValues.length }, () => null);

  if (normalizedValues.length < period) {
    return series;
  }

  const smoothingFactor = 2 / (period + 1);
  const seedAverage =
    normalizedValues.slice(0, period).reduce((sum, value) => sum + value, 0) /
    period;

  series[period - 1] = seedAverage;

  for (let index = period; index < normalizedValues.length; index += 1) {
    const previousEma = series[index - 1];
    const currentValue = normalizedValues[index];

    series[index] =
      currentValue * smoothingFactor +
      previousEma * (1 - smoothingFactor);
  }

  return series;
}
