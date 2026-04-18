import {
  DEFAULT_BINANCE_UNIVERSE_CONFIG,
  UNIVERSE_SIZE_RANGE,
} from "./binanceUniverse.js";

export const SIGNAL_INTERVALS = Object.freeze(["1m", "3m", "5m", "15m"]);
export const DEFAULT_SIGNAL_WATCHLIST_SIZE = DEFAULT_BINANCE_UNIVERSE_CONFIG.size;

export function normalizeSignalWatchlistSize(size = DEFAULT_SIGNAL_WATCHLIST_SIZE) {
  if (
    !Number.isInteger(size) ||
    size < UNIVERSE_SIZE_RANGE.min ||
    size > UNIVERSE_SIZE_RANGE.max
  ) {
    throw new Error(
      `Signal watchlist size must be between ${UNIVERSE_SIZE_RANGE.min} and ${UNIVERSE_SIZE_RANGE.max}`,
    );
  }

  return size;
}

export function isSupportedSignalInterval(interval) {
  return SIGNAL_INTERVALS.includes(interval);
}

export function createSignalStreamName(symbol, interval) {
  if (!isSupportedSignalInterval(interval)) {
    throw new Error(`Unsupported signal interval: ${interval}`);
  }

  return `${symbol.toLowerCase()}@kline_${interval}`;
}

export function createSignalSubscriptions(
  symbols,
  intervals = SIGNAL_INTERVALS,
) {
  const uniqueSymbols = [...new Set(symbols)];
  const uniqueIntervals = [...new Set(intervals)];

  return Object.freeze(
    uniqueSymbols.flatMap((symbol) =>
      uniqueIntervals.map((interval) =>
        Object.freeze({
          symbol,
          interval,
          streamName: createSignalStreamName(symbol, interval),
        }),
      ),
    ),
  );
}
