const RAW_MARKET_OPTIONS = [
  {
    symbol: "BTCUSDT",
    label: "비트코인",
    baseAsset: "BTC",
    quoteAsset: "USDT",
  },
  {
    symbol: "ETHUSDT",
    label: "이더리움",
    baseAsset: "ETH",
    quoteAsset: "USDT",
  },
  {
    symbol: "SOLUSDT",
    label: "솔라나",
    baseAsset: "SOL",
    quoteAsset: "USDT",
  },
  {
    symbol: "XRPUSDT",
    label: "리플",
    baseAsset: "XRP",
    quoteAsset: "USDT",
  },
  {
    symbol: "DOGEUSDT",
    label: "도지코인",
    baseAsset: "DOGE",
    quoteAsset: "USDT",
  },
];

export const MARKET_OPTIONS = Object.freeze(
  RAW_MARKET_OPTIONS.map((market) => Object.freeze({ ...market })),
);

export const MARKET_SYMBOLS = Object.freeze(
  MARKET_OPTIONS.map(({ symbol }) => symbol),
);

export const DEFAULT_ACTIVE_SYMBOL = MARKET_SYMBOLS[0];
export const DEFAULT_FAVORITE_SYMBOLS = Object.freeze(["BTCUSDT", "ETHUSDT"]);

function normalizeSymbol(symbol) {
  if (typeof symbol !== "string") {
    return "";
  }

  return symbol.trim().toUpperCase();
}

export function formatMarketPair(symbol) {
  const market = getMarketOption(symbol);

  if (market) {
    return `${market.baseAsset} / ${market.quoteAsset}`;
  }

  const normalizedSymbol = normalizeSymbol(symbol);

  if (normalizedSymbol.endsWith("USDT")) {
    return `${normalizedSymbol.slice(0, -4)} / USDT`;
  }

  return normalizedSymbol;
}

export function getMarketOption(symbol) {
  const normalizedSymbol = normalizeSymbol(symbol);

  return MARKET_OPTIONS.find((market) => market.symbol === normalizedSymbol) ?? null;
}

export function getMarketLabel(symbol) {
  return getMarketOption(symbol)?.label ?? normalizeSymbol(symbol);
}

export function getMarketDisplay(symbol) {
  const market = getMarketOption(symbol);

  if (market) {
    return {
      name: market.label,
      pair: `${market.baseAsset} / ${market.quoteAsset}`,
      symbol: market.symbol,
    };
  }

  const normalizedSymbol = normalizeSymbol(symbol);

  return {
    name: normalizedSymbol,
    pair: formatMarketPair(normalizedSymbol),
    symbol: normalizedSymbol,
  };
}

export function isConfiguredMarketSymbol(symbol) {
  return MARKET_SYMBOLS.includes(normalizeSymbol(symbol));
}
