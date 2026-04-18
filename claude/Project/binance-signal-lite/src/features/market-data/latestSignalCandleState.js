const SIGNAL_INTERVAL_DURATION_MS = Object.freeze({
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
});

export const DEFAULT_SIGNAL_MARKET_FRESHNESS_GRACE_MS = 2_000;

function cloneLatestCandle(candle) {
  if (!candle) {
    return null;
  }

  return { ...candle };
}

function getTrackedBucket(marketData, symbol, interval) {
  return marketData?.markets?.[symbol]?.series?.[interval] ?? null;
}

function normalizeSilenceMs(updatedAt, asOf) {
  if (updatedAt == null || asOf == null) {
    return null;
  }

  return Math.max(0, asOf - updatedAt);
}

function createStatus({ latestCandle, silenceMs, maxSilenceMs }) {
  if (!latestCandle) {
    return "pending";
  }

  if (silenceMs == null || maxSilenceMs == null) {
    return "active";
  }

  return silenceMs <= maxSilenceMs ? "active" : "stale";
}

export function createSignalMarketKey(symbol, interval) {
  return `${symbol}:${interval}`;
}

export function getSignalIntervalDurationMs(interval) {
  const durationMs = SIGNAL_INTERVAL_DURATION_MS[interval];

  if (!durationMs) {
    throw new Error(`Unsupported signal interval: ${interval}`);
  }

  return durationMs;
}

export function createLatestSignalCandleEntry(
  {
    symbol,
    interval,
    streamName = null,
  },
  {
    marketData = null,
    asOf = Date.now(),
    freshnessGraceMs = DEFAULT_SIGNAL_MARKET_FRESHNESS_GRACE_MS,
  } = {},
) {
  const bucket = getTrackedBucket(marketData, symbol, interval);
  const latestCandle = cloneLatestCandle(bucket?.candles?.at(-1) ?? null);
  const maxSilenceMs = getSignalIntervalDurationMs(interval) + freshnessGraceMs;
  const silenceMs = normalizeSilenceMs(bucket?.updatedAt ?? null, asOf);
  const status = createStatus({
    latestCandle,
    silenceMs,
    maxSilenceMs,
  });

  return {
    key: createSignalMarketKey(symbol, interval),
    symbol,
    interval,
    streamName,
    status,
    isActive: status === "active",
    hasCandle: latestCandle !== null,
    updatedAt: bucket?.updatedAt ?? null,
    silenceMs,
    maxSilenceMs,
    lastEventTime: bucket?.lastEventTime ?? latestCandle?.eventTime ?? null,
    lastOpenTime: bucket?.lastOpenTime ?? latestCandle?.openTime ?? null,
    lastCloseTime: bucket?.lastCloseTime ?? latestCandle?.closeTime ?? null,
    latestCandle,
  };
}

export function createLatestSignalCandleState({
  marketData = null,
  subscriptions = [],
  asOf = Date.now(),
  freshnessGraceMs = DEFAULT_SIGNAL_MARKET_FRESHNESS_GRACE_MS,
} = {}) {
  const items = subscriptions.map((subscription) =>
    createLatestSignalCandleEntry(subscription, {
      marketData,
      asOf,
      freshnessGraceMs,
    }),
  );
  const byKey = Object.fromEntries(items.map((item) => [item.key, item]));
  const bySymbol = {};

  items.forEach((item) => {
    if (!bySymbol[item.symbol]) {
      bySymbol[item.symbol] = {};
    }

    bySymbol[item.symbol][item.interval] = item;
  });

  const activeItems = items.filter((item) => item.status === "active");
  const staleItems = items.filter((item) => item.status === "stale");
  const pendingItems = items.filter((item) => item.status === "pending");

  return {
    asOf,
    freshnessGraceMs,
    totalSubscriptions: items.length,
    activeSubscriptions: activeItems.length,
    staleSubscriptions: staleItems.length,
    pendingSubscriptions: pendingItems.length,
    allSubscribedMarketsActive:
      items.length > 0 && activeItems.length === items.length,
    activeSymbols: [...new Set(activeItems.map((item) => item.symbol))],
    staleSymbols: [...new Set(staleItems.map((item) => item.symbol))],
    pendingSymbols: [...new Set(pendingItems.map((item) => item.symbol))],
    items,
    byKey,
    bySymbol,
  };
}
