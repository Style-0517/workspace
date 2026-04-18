import { MARKET_SYMBOLS } from "./marketCatalog.js";

export const BINANCE_REST_BASE_URL = "https://api.binance.com";
export const BINANCE_STREAM_BASE_URL = "wss://data-stream.binance.vision";

const BINANCE_SYMBOL_PATTERN = /^[A-Z0-9]{4,20}$/;

export const SUPPORTED_SYMBOLS = MARKET_SYMBOLS;
export const SUPPORTED_INTERVALS = Object.freeze(["1m", "3m", "5m", "15m"]);
export const DEFAULT_STREAM_INTERVALS = Object.freeze(["1m", "5m"]);

function normalizeSymbol(symbol) {
  if (typeof symbol !== "string") {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }

  return symbol.trim().toUpperCase();
}

function normalizeInterval(interval) {
  if (typeof interval !== "string") {
    throw new Error(`Unsupported interval: ${interval}`);
  }

  return interval.trim();
}

function assertSupportedSymbol(symbol) {
  if (!isSupportedSymbol(symbol)) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }
}

function assertSupportedInterval(interval) {
  if (!isSupportedInterval(interval)) {
    throw new Error(`Unsupported interval: ${interval}`);
  }
}

export function createKlineStreamName(symbol, interval) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedInterval = normalizeInterval(interval);

  assertSupportedSymbol(normalizedSymbol);
  assertSupportedInterval(normalizedInterval);

  return `${normalizedSymbol.toLowerCase()}@kline_${normalizedInterval}`;
}

export function createMiniTickerStreamName(symbol) {
  const normalizedSymbol = normalizeSymbol(symbol);

  assertSupportedSymbol(normalizedSymbol);

  return `${normalizedSymbol.toLowerCase()}@miniTicker`;
}

function normalizeCollection(values, normalizer, label) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`At least one ${label} is required`);
  }

  return [...new Set(values.map((value) => normalizer(value)))];
}

export function createStreamSubscriptions({
  symbols = SUPPORTED_SYMBOLS,
  intervals = DEFAULT_STREAM_INTERVALS,
} = {}) {
  const normalizedSymbols = normalizeCollection(symbols, normalizeSymbol, "symbol");
  const normalizedIntervals = normalizeCollection(
    intervals,
    normalizeInterval,
    "interval",
  );

  normalizedSymbols.forEach(assertSupportedSymbol);
  normalizedIntervals.forEach(assertSupportedInterval);

  return Object.freeze(
    normalizedSymbols.flatMap((symbol) =>
      normalizedIntervals.map((interval) =>
        Object.freeze({
          symbol,
          interval,
          streamName: createKlineStreamName(symbol, interval),
        }),
      ),
    ),
  );
}

export const STREAM_SUBSCRIPTIONS = createStreamSubscriptions();

export const STREAM_NAMES = Object.freeze(
  STREAM_SUBSCRIPTIONS.map(({ streamName }) => streamName),
);

export const RAW_SUBSCRIBE_REQUEST = Object.freeze({
  method: "SUBSCRIBE",
  params: STREAM_NAMES,
  id: 1,
});

export function findSubscription(
  symbol,
  interval,
  subscriptions = STREAM_SUBSCRIPTIONS,
) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedInterval = normalizeInterval(interval);

  assertSupportedSymbol(normalizedSymbol);
  assertSupportedInterval(normalizedInterval);

  return (
    subscriptions.find(
      (subscription) =>
        subscription.symbol === normalizedSymbol &&
        subscription.interval === normalizedInterval,
    ) ??
    Object.freeze({
      symbol: normalizedSymbol,
      interval: normalizedInterval,
      streamName: createKlineStreamName(normalizedSymbol, normalizedInterval),
    })
  );
}

export function isSupportedSymbol(symbol) {
  if (typeof symbol !== "string") {
    return false;
  }

  return BINANCE_SYMBOL_PATTERN.test(symbol.trim().toUpperCase());
}

export function isSupportedInterval(interval) {
  if (typeof interval !== "string") {
    return false;
  }

  return SUPPORTED_INTERVALS.includes(interval.trim());
}
