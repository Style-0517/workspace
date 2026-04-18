function createSeed(input) {
  return Array.from(input).reduce((seed, character) => {
    return (seed * 31 + character.charCodeAt(0)) >>> 0;
  }, 7);
}

function nextRandom(seedState) {
  const nextSeed = (seedState * 1664525 + 1013904223) >>> 0;

  return {
    seed: nextSeed,
    value: nextSeed / 4294967295,
  };
}

export function generateMockCandles(panel, count = 48) {
  const basePrice = panel.symbol === "BTCUSDT" ? 68500 : 3550;
  const volatility = panel.timeframe === "1m" ? 90 : 140;
  const seedKey = `${panel.symbol}:${panel.timeframe}`;
  let seed = createSeed(seedKey);
  let price = basePrice;

  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(index / (panel.timeframe === "1m" ? 4.2 : 5.7)) * volatility;
    const waveSlow = Math.cos(index / 11) * (volatility * 0.45);

    const noise = nextRandom(seed);
    seed = noise.seed;
    const shock = (noise.value - 0.5) * volatility * 1.8;

    const open = price;
    const close = Math.max(1, open + wave * 0.08 + waveSlow * 0.12 + shock);
    const high = Math.max(open, close) + Math.abs(shock) * 0.55 + volatility * 0.18;
    const low = Math.min(open, close) - Math.abs(shock) * 0.5 - volatility * 0.15;

    price = close;

    return {
      open,
      high,
      low,
      close,
    };
  });
}
