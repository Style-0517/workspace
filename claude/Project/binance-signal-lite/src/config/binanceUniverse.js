import { deepFreeze } from "../shared/deep-freeze.js";

export const UNIVERSE_SIZE_RANGE = deepFreeze({
  min: 20,
  max: 30,
  default: 25,
});

export const BINANCE_UNIVERSE_RANKING = deepFreeze({
  QUOTE_VOLUME: "quoteVolume",
  TRADE_COUNT: "tradeCount",
});

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const STABLECOIN_BASE_ASSETS = Object.freeze([
  "USDC",
  "FDUSD",
  "TUSD",
  "USDP",
  "BUSD",
  "DAI",
  "USDS",
  "USDE",
  "USDD",
  "PYUSD",
]);

const LEVERAGED_TOKEN_SUFFIXES = Object.freeze(["UP", "DOWN", "BULL", "BEAR"]);

export const DEFAULT_BINANCE_UNIVERSE_CONFIG = deepFreeze({
  quoteAsset: "USDT",
  size: UNIVERSE_SIZE_RANGE.default,
  rankingMetric: BINANCE_UNIVERSE_RANKING.QUOTE_VOLUME,
  minListingAgeDays: 30,
  allowedStatuses: ["TRADING"],
  requireSpotTradingAllowed: true,
  excludedBaseAssets: [...STABLECOIN_BASE_ASSETS],
  leveragedTokenSuffixes: [...LEVERAGED_TOKEN_SUFFIXES],
  manualSymbolExclusions: [],
});

function parseNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertUniverseSize(size) {
  if (
    !Number.isInteger(size) ||
    size < UNIVERSE_SIZE_RANGE.min ||
    size > UNIVERSE_SIZE_RANGE.max
  ) {
    throw new Error(
      `Universe size must be an integer between ${UNIVERSE_SIZE_RANGE.min} and ${UNIVERSE_SIZE_RANGE.max}`,
    );
  }
}

function assertRankingMetric(rankingMetric) {
  if (!Object.values(BINANCE_UNIVERSE_RANKING).includes(rankingMetric)) {
    throw new Error(`Unsupported universe ranking metric: ${rankingMetric}`);
  }
}

function isLeveragedTokenSymbol(symbol, quoteAsset, leveragedTokenSuffixes) {
  return leveragedTokenSuffixes.some((suffix) =>
    symbol.endsWith(`${suffix}${quoteAsset}`),
  );
}

function isWithinListingAgeThreshold(onboardDate, minListingAgeDays, now) {
  if (!Number.isFinite(onboardDate) || onboardDate <= 0) {
    return true;
  }

  return now - onboardDate >= minListingAgeDays * DAY_IN_MS;
}

function isSpotAllowed(symbolInfo, requireSpotTradingAllowed) {
  if (!requireSpotTradingAllowed) {
    return true;
  }

  if (symbolInfo.isSpotTradingAllowed === false) {
    return false;
  }

  if (Array.isArray(symbolInfo.permissions) && symbolInfo.permissions.length > 0) {
    return symbolInfo.permissions.includes("SPOT");
  }

  return true;
}

function createUniverseCandidate(ticker, symbolInfo) {
  return {
    symbol: ticker.symbol,
    baseAsset: symbolInfo.baseAsset,
    quoteAsset: symbolInfo.quoteAsset,
    status: symbolInfo.status,
    onboardDate: symbolInfo.onboardDate ?? null,
    lastPrice: parseNumber(ticker.lastPrice),
    volume: parseNumber(ticker.volume),
    quoteVolume: parseNumber(ticker.quoteVolume),
    tradeCount: parseInteger(ticker.count ?? ticker.tradeCount),
  };
}

function getRankingValue(candidate, rankingMetric) {
  return rankingMetric === BINANCE_UNIVERSE_RANKING.TRADE_COUNT
    ? candidate.tradeCount
    : candidate.quoteVolume;
}

export function normalizeUniverseConfig(overrides = {}) {
  const config = {
    ...DEFAULT_BINANCE_UNIVERSE_CONFIG,
    ...overrides,
    allowedStatuses:
      overrides.allowedStatuses ?? DEFAULT_BINANCE_UNIVERSE_CONFIG.allowedStatuses,
    excludedBaseAssets:
      overrides.excludedBaseAssets ??
      DEFAULT_BINANCE_UNIVERSE_CONFIG.excludedBaseAssets,
    leveragedTokenSuffixes:
      overrides.leveragedTokenSuffixes ??
      DEFAULT_BINANCE_UNIVERSE_CONFIG.leveragedTokenSuffixes,
    manualSymbolExclusions:
      overrides.manualSymbolExclusions ??
      DEFAULT_BINANCE_UNIVERSE_CONFIG.manualSymbolExclusions,
  };

  assertUniverseSize(config.size);
  assertRankingMetric(config.rankingMetric);
  return deepFreeze(config);
}

export function selectBinanceSignalUniverse({
  tickers24h = [],
  exchangeInfoSymbols = [],
  config: configOverrides,
  now = Date.now(),
} = {}) {
  const config = normalizeUniverseConfig(configOverrides);
  const exchangeInfoBySymbol = new Map(
    exchangeInfoSymbols.map((symbolInfo) => [symbolInfo.symbol, symbolInfo]),
  );
  const manualExclusions = new Set(config.manualSymbolExclusions);
  const candidates = [];

  for (const ticker of tickers24h) {
    const symbolInfo = exchangeInfoBySymbol.get(ticker.symbol);

    if (!symbolInfo) {
      continue;
    }

    if (symbolInfo.quoteAsset !== config.quoteAsset) {
      continue;
    }

    if (!config.allowedStatuses.includes(symbolInfo.status)) {
      continue;
    }

    if (symbolInfo.baseAsset === config.quoteAsset) {
      continue;
    }

    if (config.excludedBaseAssets.includes(symbolInfo.baseAsset)) {
      continue;
    }

    if (manualExclusions.has(symbolInfo.symbol)) {
      continue;
    }

    if (
      isLeveragedTokenSymbol(
        symbolInfo.symbol,
        config.quoteAsset,
        config.leveragedTokenSuffixes,
      )
    ) {
      continue;
    }

    if (!isSpotAllowed(symbolInfo, config.requireSpotTradingAllowed)) {
      continue;
    }

    if (
      !isWithinListingAgeThreshold(
        symbolInfo.onboardDate,
        config.minListingAgeDays,
        now,
      )
    ) {
      continue;
    }

    const candidate = createUniverseCandidate(ticker, symbolInfo);
    candidates.push(candidate);
  }

  const selectedMarkets = candidates
    .sort((left, right) => {
      const rankingDifference =
        getRankingValue(right, config.rankingMetric) -
        getRankingValue(left, config.rankingMetric);

      if (rankingDifference !== 0) {
        return rankingDifference;
      }

      if (right.quoteVolume !== left.quoteVolume) {
        return right.quoteVolume - left.quoteVolume;
      }

      if (right.tradeCount !== left.tradeCount) {
        return right.tradeCount - left.tradeCount;
      }

      return left.symbol.localeCompare(right.symbol);
    })
    .slice(0, config.size)
    .map((candidate, index) =>
      deepFreeze({
        ...candidate,
        rank: index + 1,
        rankingMetric: config.rankingMetric,
        rankingValue: getRankingValue(candidate, config.rankingMetric),
      }),
    );

  return deepFreeze({
    asOf: now,
    quoteAsset: config.quoteAsset,
    rankingMetric: config.rankingMetric,
    size: config.size,
    symbols: selectedMarkets.map(({ symbol }) => symbol),
    markets: selectedMarkets,
  });
}
