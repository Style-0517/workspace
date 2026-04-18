import test from "node:test";
import assert from "node:assert/strict";

import { chartPanels } from "../src/data/chartPanels.js";
import {
  BinanceChartFeed,
  PANEL_STATUS,
  mergeKlineIntoSeries,
} from "../src/services/binanceChartFeed.js";

function createSeedCandle(basePrice, openTime) {
  return {
    openTime,
    open: basePrice,
    high: basePrice + 8,
    low: basePrice - 6,
    close: basePrice + 3,
    volume: 12.5,
    closeTime: openTime + 59999,
    quoteVolume: 25000,
    tradeCount: 120,
    takerBuyBaseVolume: 6.2,
    takerBuyQuoteVolume: 12400,
  };
}

function createStreamKline({
  symbol,
  interval,
  openTime,
  close,
  isClosed = false,
}) {
  return {
    streamName: `${symbol.toLowerCase()}@kline_${interval}`,
    symbol,
    interval,
    eventTime: openTime + 60000,
    openTime,
    closeTime: openTime + 59999,
    open: close - 4,
    high: close + 6,
    low: close - 8,
    close,
    volume: 18,
    quoteVolume: 32000,
    tradeCount: 144,
    takerBuyBaseVolume: 8.4,
    takerBuyQuoteVolume: 15200,
    isClosed,
  };
}

function createMiniTicker({
  symbol,
  closePrice,
  eventTime = 0,
}) {
  return {
    streamName: `${symbol.toLowerCase()}@miniTicker`,
    symbol,
    eventTime,
    closePrice,
    openPrice: closePrice - 120,
    highPrice: closePrice + 180,
    lowPrice: closePrice - 240,
    baseVolume: 1234,
    quoteVolume: 56789000,
  };
}

class FakeMarketDataClient {
  constructor(seedByKey) {
    this.seedByKey = seedByKey;
    this.fetchCalls = [];
    this.connectCalls = [];
    this.disconnectCount = 0;
    this.handlers = null;
    this.subscriptionUpdates = [];
  }

  async fetchSeedKlines({ symbol, interval, limit }) {
    this.fetchCalls.push({ symbol, interval, limit });
    return this.seedByKey.get(`${symbol}:${interval}`) ?? [];
  }

  connect(handlers) {
    this.connectCalls.push(handlers);
    this.handlers = handlers;

    return {
      close() {},
    };
  }

  disconnect() {
    this.disconnectCount += 1;
  }

  setSubscriptions(subscriptions) {
    this.subscriptionUpdates.push(subscriptions);
    return subscriptions;
  }

  emitOpen() {
    this.handlers?.onOpen?.();
  }

  emitKline(kline) {
    this.handlers?.onKline?.(kline);
  }

  emitMiniTicker(miniTicker) {
    this.handlers?.onMiniTicker?.(miniTicker);
  }
}

function createSeedMap() {
  return new Map([
    [
      "BTCUSDT:1m",
      [createSeedCandle(68000, 60_000), createSeedCandle(68040, 120_000)],
    ],
    [
      "BTCUSDT:5m",
      [createSeedCandle(68100, 300_000), createSeedCandle(68140, 600_000)],
    ],
    [
      "ETHUSDT:1m",
      [createSeedCandle(3500, 60_000), createSeedCandle(3515, 120_000)],
    ],
    [
      "ETHUSDT:5m",
      [createSeedCandle(3520, 300_000), createSeedCandle(3535, 600_000)],
    ],
  ]);
}

test("BinanceChartFeed fetches seed candles for every default chart panel", async () => {
  const client = new FakeMarketDataClient(createSeedMap());
  const feed = new BinanceChartFeed({
    marketDataClient: client,
    seedLimit: 2,
  });

  await feed.start();

  assert.deepEqual(
    client.fetchCalls,
    chartPanels.map(({ symbol, timeframe }) => ({
      symbol,
      interval: timeframe,
      limit: 2,
    })),
  );
  assert.equal(client.connectCalls.length, 1);
  assert.deepEqual(
    feed.keys,
    chartPanels.map(({ symbol, timeframe }) => `${symbol}:${timeframe}`),
  );

  const snapshot = feed.getSnapshot({
    symbol: "ETHUSDT",
    timeframe: "5m",
  });

  assert.equal(snapshot.status, PANEL_STATUS.READY);
  assert.equal(snapshot.candles.length, 2);
  assert.equal(snapshot.lastUpdatedFrom, "rest");
  assert.equal(snapshot.lastPrice, 3538);
  assert.equal(snapshot.lastPriceSource, "seed");
  assert.equal(snapshot.candles.at(-1).close, 3538);
});

test("BinanceChartFeed aligns websocket subscriptions to the configured panel timeframes", () => {
  const client = new FakeMarketDataClient(createSeedMap());

  new BinanceChartFeed({
    marketDataClient: client,
    panels: [
      { symbol: "BTCUSDT", timeframe: "3m" },
      { symbol: "ETHUSDT", timeframe: "15m" },
    ],
  });

  assert.deepEqual(client.subscriptionUpdates.at(-1), [
    { symbol: "BTCUSDT", interval: "3m", streamName: "btcusdt@kline_3m" },
    { symbol: "ETHUSDT", interval: "15m", streamName: "ethusdt@kline_15m" },
    {
      symbol: "BTCUSDT",
      channel: "miniTicker",
      streamName: "btcusdt@miniTicker",
    },
    {
      symbol: "ETHUSDT",
      channel: "miniTicker",
      streamName: "ethusdt@miniTicker",
    },
  ]);
});

test("BinanceChartFeed routes kline updates only to the matching panel and marks streaming state", async () => {
  const client = new FakeMarketDataClient(
    new Map([
      [
        "BTCUSDT:1m",
        [createSeedCandle(68000, 60_000), createSeedCandle(68040, 120_000)],
      ],
      [
        "ETHUSDT:5m",
        [createSeedCandle(3520, 300_000), createSeedCandle(3535, 600_000)],
      ],
    ]),
  );
  const feed = new BinanceChartFeed({
    marketDataClient: client,
    panels: [
      { symbol: "BTCUSDT", timeframe: "1m" },
      { symbol: "ETHUSDT", timeframe: "5m" },
    ],
    seedLimit: 2,
  });
  const btcSnapshots = [];
  const ethSnapshots = [];

  feed.subscribe(
    { symbol: "BTCUSDT", timeframe: "1m" },
    (snapshot) => {
      btcSnapshots.push(snapshot);
    },
    { emitCurrent: false },
  );
  feed.subscribe(
    { symbol: "ETHUSDT", timeframe: "5m" },
    (snapshot) => {
      ethSnapshots.push(snapshot);
    },
    { emitCurrent: false },
  );

  await feed.start();
  client.emitOpen();
  client.emitKline(
    createStreamKline({
      symbol: "BTCUSDT",
      interval: "1m",
      openTime: 120_000,
      close: 68120,
    }),
  );

  assert.equal(btcSnapshots.at(-1).status, PANEL_STATUS.STREAMING);
  assert.equal(btcSnapshots.at(-1).candles.length, 2);
  assert.equal(btcSnapshots.at(-1).candles.at(-1).openTime, 120_000);
  assert.equal(btcSnapshots.at(-1).candles.at(-1).close, 68120);
  assert.equal(btcSnapshots.at(-1).lastUpdatedFrom, "stream");

  assert.equal(ethSnapshots.at(-1).status, PANEL_STATUS.STREAMING);
  assert.equal(ethSnapshots.at(-1).candles.length, 2);
  assert.equal(ethSnapshots.at(-1).candles.at(-1).openTime, 600_000);
  assert.equal(ethSnapshots.at(-1).candles.at(-1).close, 3538);
  assert.equal(ethSnapshots.at(-1).lastUpdatedFrom, "rest");
});

test("BinanceChartFeed applies ETHUSDT realtime klines to the matching 1m and 5m panel states", async () => {
  const client = new FakeMarketDataClient(
    new Map([
      [
        "ETHUSDT:1m",
        [createSeedCandle(3500, 60_000), createSeedCandle(3515, 120_000)],
      ],
      [
        "ETHUSDT:5m",
        [createSeedCandle(3520, 300_000), createSeedCandle(3535, 600_000)],
      ],
    ]),
  );
  const feed = new BinanceChartFeed({
    marketDataClient: client,
    panels: [
      { symbol: "ETHUSDT", timeframe: "1m" },
      { symbol: "ETHUSDT", timeframe: "5m" },
    ],
    seedLimit: 3,
  });

  await feed.start();
  client.emitOpen();
  client.emitKline(
    createStreamKline({
      symbol: "ETHUSDT",
      interval: "1m",
      openTime: 180_000,
      close: 3526,
    }),
  );
  client.emitKline(
    createStreamKline({
      symbol: "ETHUSDT",
      interval: "5m",
      openTime: 900_000,
      close: 3554,
      isClosed: true,
    }),
  );

  const oneMinuteSnapshot = feed.getSnapshot({
    symbol: "ETHUSDT",
    timeframe: "1m",
  });
  const fiveMinuteSnapshot = feed.getSnapshot({
    symbol: "ETHUSDT",
    timeframe: "5m",
  });

  assert.equal(oneMinuteSnapshot.status, PANEL_STATUS.STREAMING);
  assert.equal(oneMinuteSnapshot.lastUpdatedFrom, "stream");
  assert.equal(oneMinuteSnapshot.candles.length, 3);
  assert.equal(oneMinuteSnapshot.candles.at(-1).openTime, 180_000);
  assert.equal(oneMinuteSnapshot.candles.at(-1).close, 3526);
  assert.equal(oneMinuteSnapshot.lastKline.symbol, "ETHUSDT");
  assert.equal(oneMinuteSnapshot.lastKline.interval, "1m");

  assert.equal(fiveMinuteSnapshot.status, PANEL_STATUS.STREAMING);
  assert.equal(fiveMinuteSnapshot.lastUpdatedFrom, "stream");
  assert.equal(fiveMinuteSnapshot.candles.length, 3);
  assert.equal(fiveMinuteSnapshot.candles.at(-1).openTime, 900_000);
  assert.equal(fiveMinuteSnapshot.candles.at(-1).close, 3554);
  assert.equal(fiveMinuteSnapshot.candles.at(-1).isClosed, true);
  assert.equal(fiveMinuteSnapshot.lastKline.symbol, "ETHUSDT");
  assert.equal(fiveMinuteSnapshot.lastKline.interval, "5m");
});

test("BinanceChartFeed mirrors live mini ticker prices into every matching symbol panel", async () => {
  const client = new FakeMarketDataClient(
    new Map([
      [
        "ETHUSDT:1m",
        [createSeedCandle(3500, 60_000), createSeedCandle(3515, 120_000)],
      ],
      [
        "ETHUSDT:5m",
        [createSeedCandle(3520, 300_000), createSeedCandle(3535, 600_000)],
      ],
    ]),
  );
  const feed = new BinanceChartFeed({
    marketDataClient: client,
    panels: [
      { symbol: "ETHUSDT", timeframe: "1m" },
      { symbol: "ETHUSDT", timeframe: "5m" },
    ],
    seedLimit: 3,
  });

  await feed.start();
  client.emitOpen();
  client.emitMiniTicker(
    createMiniTicker({
      symbol: "ETHUSDT",
      closePrice: 3561.75,
      eventTime: 900_123,
    }),
  );

  const oneMinuteSnapshot = feed.getSnapshot({
    symbol: "ETHUSDT",
    timeframe: "1m",
  });
  const fiveMinuteSnapshot = feed.getSnapshot({
    symbol: "ETHUSDT",
    timeframe: "5m",
  });

  assert.equal(oneMinuteSnapshot.lastPrice, 3561.75);
  assert.equal(oneMinuteSnapshot.lastPriceTime, 900_123);
  assert.equal(oneMinuteSnapshot.lastPriceSource, "ticker");
  assert.equal(oneMinuteSnapshot.candles.at(-1).close, 3518);

  assert.equal(fiveMinuteSnapshot.lastPrice, 3561.75);
  assert.equal(fiveMinuteSnapshot.lastPriceTime, 900_123);
  assert.equal(fiveMinuteSnapshot.lastPriceSource, "ticker");
  assert.equal(fiveMinuteSnapshot.candles.at(-1).close, 3538);
});

test("mergeKlineIntoSeries replaces in-flight candles and trims appended history to the configured limit", () => {
  const baseSeries = [
    createSeedCandle(68000, 60_000),
    createSeedCandle(68040, 120_000),
  ];
  const replaced = mergeKlineIntoSeries(
    baseSeries,
    createStreamKline({
      symbol: "BTCUSDT",
      interval: "1m",
      openTime: 120_000,
      close: 68120,
    }),
    2,
  );
  const trimmed = mergeKlineIntoSeries(
    replaced,
    createStreamKline({
      symbol: "BTCUSDT",
      interval: "1m",
      openTime: 180_000,
      close: 68160,
      isClosed: true,
    }),
    2,
  );

  assert.deepEqual(
    replaced.map((candle) => candle.openTime),
    [60_000, 120_000],
  );
  assert.equal(replaced.at(-1).close, 68120);
  assert.deepEqual(
    trimmed.map((candle) => candle.openTime),
    [120_000, 180_000],
  );
  assert.equal(trimmed.at(-1).close, 68160);
  assert.equal(trimmed.at(-1).isClosed, true);
});

test("BinanceChartFeed stop disconnects the underlying client and unsubscribed listeners stop receiving updates", async () => {
  const client = new FakeMarketDataClient(
    new Map([
      [
        "BTCUSDT:1m",
        [createSeedCandle(68000, 60_000), createSeedCandle(68040, 120_000)],
      ],
    ]),
  );
  const feed = new BinanceChartFeed({
    marketDataClient: client,
    panels: [{ symbol: "BTCUSDT", timeframe: "1m" }],
    seedLimit: 2,
  });
  let notificationCount = 0;
  const unsubscribe = feed.subscribe(
    { symbol: "BTCUSDT", timeframe: "1m" },
    () => {
      notificationCount += 1;
    },
    { emitCurrent: false },
  );

  await feed.start();
  const countBeforeUnsubscribe = notificationCount;
  unsubscribe();
  client.emitOpen();
  client.emitKline(
    createStreamKline({
      symbol: "BTCUSDT",
      interval: "1m",
      openTime: 120_000,
      close: 68120,
    }),
  );
  feed.stop();

  assert.equal(client.disconnectCount, 1);
  assert.equal(countBeforeUnsubscribe, 2);
  assert.equal(notificationCount, countBeforeUnsubscribe);
  assert.equal(
    feed.getSnapshot({ symbol: "BTCUSDT", timeframe: "1m" }).status,
    PANEL_STATUS.STOPPED,
  );
});
