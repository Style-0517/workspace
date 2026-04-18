import test from "node:test";
import assert from "node:assert/strict";

import { BINANCE_UNIVERSE_RANKING } from "../src/config/binanceUniverse.js";
import {
  SUPPORTED_SYMBOLS,
  SUPPORTED_INTERVALS,
  RAW_SUBSCRIBE_REQUEST,
  STREAM_NAMES,
  STREAM_SUBSCRIPTIONS,
  createMiniTickerStreamName,
  createKlineStreamName,
  createStreamSubscriptions,
} from "../src/config/binanceStreams.js";
import {
  BinanceMarketDataClient,
  createCombinedStreamUrl,
  createExchangeInfoUrl,
  createKlinesUrl,
  createTicker24hrUrl,
  normalizeMiniTickerPayload,
  normalizeKlinePayload,
} from "../src/services/binanceMarketDataClient.js";

test("createKlineStreamName builds lowercase Binance kline channels", () => {
  assert.equal(createKlineStreamName("BTCUSDT", "1m"), "btcusdt@kline_1m");
  assert.equal(createKlineStreamName("ethusdt", "5m"), "ethusdt@kline_5m");
  assert.equal(createKlineStreamName("SOLUSDT", "15m"), "solusdt@kline_15m");
  assert.equal(createMiniTickerStreamName("BTCUSDT"), "btcusdt@miniTicker");
});

test("default chart subscription config expands the supported symbol list across 1m/5m", () => {
  assert.deepEqual(SUPPORTED_INTERVALS, ["1m", "3m", "5m", "15m"]);
  const expectedSubscriptions = SUPPORTED_SYMBOLS.flatMap((symbol) => [
    { symbol, interval: "1m", streamName: `${symbol.toLowerCase()}@kline_1m` },
    { symbol, interval: "5m", streamName: `${symbol.toLowerCase()}@kline_5m` },
  ]);
  assert.deepEqual(
    STREAM_SUBSCRIPTIONS,
    expectedSubscriptions,
  );

  assert.deepEqual(RAW_SUBSCRIBE_REQUEST, {
    method: "SUBSCRIBE",
    params: STREAM_NAMES,
    id: 1,
  });
});

test("createStreamSubscriptions expands a configured symbol universe across supported timeframes", () => {
  assert.deepEqual(
    createStreamSubscriptions({
      symbols: ["BTCUSDT", "solusdt", "BTCUSDT"],
      intervals: ["1m", "15m", "1m"],
    }),
    [
      { symbol: "BTCUSDT", interval: "1m", streamName: "btcusdt@kline_1m" },
      {
        symbol: "BTCUSDT",
        interval: "15m",
        streamName: "btcusdt@kline_15m",
      },
      { symbol: "SOLUSDT", interval: "1m", streamName: "solusdt@kline_1m" },
      {
        symbol: "SOLUSDT",
        interval: "15m",
        streamName: "solusdt@kline_15m",
      },
    ],
  );
});

test("createCombinedStreamUrl targets Binance market-data endpoint", () => {
  assert.equal(
    createCombinedStreamUrl(),
    `wss://data-stream.binance.vision/stream?streams=${STREAM_SUBSCRIPTIONS.map(({ streamName }) => streamName).join("/")}`,
  );
});

test("24hr ticker and exchange-info URLs target Binance REST endpoints", () => {
  assert.equal(
    createTicker24hrUrl(),
    "https://api.binance.com/api/v3/ticker/24hr",
  );
  assert.equal(
    createExchangeInfoUrl(),
    "https://api.binance.com/api/v3/exchangeInfo",
  );
});

test("createKlinesUrl builds Binance REST query for supported pairs", () => {
  assert.equal(
    createKlinesUrl({ symbol: "BTCUSDT", interval: "5m", limit: 200 }),
    "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=200",
  );
  assert.equal(
    createKlinesUrl({ symbol: "SOLUSDT", interval: "15m", limit: 120 }),
    "https://api.binance.com/api/v3/klines?symbol=SOLUSDT&interval=15m&limit=120",
  );
});

test("normalizeKlinePayload maps combined stream payloads into candle objects", () => {
  const normalized = normalizeKlinePayload({
    stream: "btcusdt@kline_1m",
    data: {
      e: "kline",
      E: 1712830000000,
      s: "BTCUSDT",
      k: {
        t: 1712829960000,
        T: 1712830019999,
        s: "BTCUSDT",
        i: "1m",
        o: "68000.10",
        c: "68010.30",
        h: "68020.00",
        l: "67990.20",
        v: "12.345",
        q: "839123.12",
        n: 152,
        V: "6.789",
        Q: "461223.56",
        x: false,
      },
    },
  });

  assert.deepEqual(normalized, {
    streamName: "btcusdt@kline_1m",
    symbol: "BTCUSDT",
    interval: "1m",
    eventTime: 1712830000000,
    openTime: 1712829960000,
    closeTime: 1712830019999,
    open: 68000.1,
    high: 68020,
    low: 67990.2,
    close: 68010.3,
    volume: 12.345,
    quoteVolume: 839123.12,
    tradeCount: 152,
    takerBuyBaseVolume: 6.789,
    takerBuyQuoteVolume: 461223.56,
    isClosed: false,
  });
});

test("normalizeMiniTickerPayload maps combined stream payloads into live price objects", () => {
  const normalized = normalizeMiniTickerPayload({
    stream: "btcusdt@miniTicker",
    data: {
      e: "24hrMiniTicker",
      E: 1712830000456,
      s: "BTCUSDT",
      c: "68011.25",
      o: "67200.00",
      h: "68450.10",
      l: "66880.55",
      v: "12345.678",
      q: "839123456.12",
    },
  });

  assert.deepEqual(normalized, {
    streamName: "btcusdt@miniTicker",
    symbol: "BTCUSDT",
    eventTime: 1712830000456,
    closePrice: 68011.25,
    openPrice: 67200,
    highPrice: 68450.1,
    lowPrice: 66880.55,
    baseVolume: 12345.678,
    quoteVolume: 839123456.12,
  });
});

test("BinanceMarketDataClient connects with the predefined combined stream URL", () => {
  const openedUrls = [];

  class FakeSocket {
    constructor(url) {
      openedUrls.push(url);
      this.url = url;
    }

    close() {}
  }

  const client = new BinanceMarketDataClient({
    fetchImpl: async () => ({ ok: true, json: async () => [] }),
    webSocketFactory: (url) => new FakeSocket(url),
  });

  client.connect();

  assert.deepEqual(openedUrls, [
    `wss://data-stream.binance.vision/stream?streams=${STREAM_SUBSCRIPTIONS.map(({ streamName }) => streamName).join("/")}`,
  ]);
});

test("BinanceMarketDataClient routes mini ticker payloads to the live-price handler", () => {
  class FakeSocket {
    constructor() {
      this.onmessage = null;
    }

    close() {}
  }

  const socket = new FakeSocket();
  const prices = [];
  const client = new BinanceMarketDataClient({
    fetchImpl: async () => ({ ok: true, json: async () => [] }),
    webSocketFactory: () => socket,
    subscriptions: [
      { symbol: "BTCUSDT", streamName: "btcusdt@miniTicker" },
    ],
  });

  client.connect({
    onMiniTicker: (payload) => {
      prices.push(payload);
    },
  });

  socket.onmessage?.({
    data: JSON.stringify({
      stream: "btcusdt@miniTicker",
      data: {
        e: "24hrMiniTicker",
        E: 1712830000456,
        s: "BTCUSDT",
        c: "68011.25",
        o: "67200.00",
        h: "68450.10",
        l: "66880.55",
        v: "12345.678",
        q: "839123456.12",
      },
    }),
  });

  assert.equal(prices.length, 1);
  assert.equal(prices[0].symbol, "BTCUSDT");
  assert.equal(prices[0].closePrice, 68011.25);
});

test("BinanceMarketDataClient allows replacing subscriptions for a configured pair universe", () => {
  const client = new BinanceMarketDataClient({
    fetchImpl: async () => ({ ok: true, json: async () => [] }),
    webSocketFactory: () => ({ close() {} }),
  });

  client.setSubscriptions(
    createStreamSubscriptions({
      symbols: ["BTCUSDT", "SOLUSDT"],
      intervals: ["3m", "15m"],
    }),
  );

  assert.equal(
    client.combinedStreamUrl,
    "wss://data-stream.binance.vision/stream?streams=btcusdt@kline_3m/btcusdt@kline_15m/solusdt@kline_3m/solusdt@kline_15m",
  );
  assert.deepEqual(client.streamNames, [
    "btcusdt@kline_3m",
    "btcusdt@kline_15m",
    "solusdt@kline_3m",
    "solusdt@kline_15m",
  ]);
});

test("BinanceMarketDataClient can replace subscriptions before connecting", () => {
  const client = new BinanceMarketDataClient({
    fetchImpl: async () => ({ ok: true, json: async () => [] }),
    webSocketFactory: () => ({ close() {} }),
  });

  client.setSubscriptions([
    { symbol: "SOLUSDT", interval: "3m", streamName: "solusdt@kline_3m" },
    { symbol: "BNBUSDT", interval: "15m", streamName: "bnbusdt@kline_15m" },
  ]);

  assert.deepEqual(client.streamNames, [
    "solusdt@kline_3m",
    "bnbusdt@kline_15m",
  ]);
  assert.equal(
    client.combinedStreamUrl,
    "wss://data-stream.binance.vision/stream?streams=solusdt@kline_3m/bnbusdt@kline_15m",
  );
});

test("BinanceMarketDataClient fetchSignalUniverse ranks mature spot USDT pairs", async () => {
  const requests = [];
  const now = Date.UTC(2026, 3, 12);

  const matureTimestamp = now - 45 * 24 * 60 * 60 * 1000;
  const freshTimestamp = now - 5 * 24 * 60 * 60 * 1000;

  const client = new BinanceMarketDataClient({
    fetchImpl: async (url) => {
      requests.push(url);

      if (url.endsWith("/api/v3/ticker/24hr")) {
        return {
          ok: true,
          json: async () => [
            { symbol: "BTCUSDT", quoteVolume: "1500000000", count: 100000 },
            { symbol: "ETHUSDT", quoteVolume: "1200000000", count: 120000 },
            { symbol: "USDCUSDT", quoteVolume: "3000000000", count: 999999 },
            { symbol: "NEWUSDT", quoteVolume: "2200000000", count: 110000 },
          ],
        };
      }

      if (url.endsWith("/api/v3/exchangeInfo")) {
        return {
          ok: true,
          json: async () => ({
            symbols: [
              {
                symbol: "BTCUSDT",
                baseAsset: "BTC",
                quoteAsset: "USDT",
                status: "TRADING",
                isSpotTradingAllowed: true,
                permissions: ["SPOT"],
                onboardDate: matureTimestamp,
              },
              {
                symbol: "ETHUSDT",
                baseAsset: "ETH",
                quoteAsset: "USDT",
                status: "TRADING",
                isSpotTradingAllowed: true,
                permissions: ["SPOT"],
                onboardDate: matureTimestamp,
              },
              {
                symbol: "USDCUSDT",
                baseAsset: "USDC",
                quoteAsset: "USDT",
                status: "TRADING",
                isSpotTradingAllowed: true,
                permissions: ["SPOT"],
                onboardDate: matureTimestamp,
              },
              {
                symbol: "NEWUSDT",
                baseAsset: "NEW",
                quoteAsset: "USDT",
                status: "TRADING",
                isSpotTradingAllowed: true,
                permissions: ["SPOT"],
                onboardDate: freshTimestamp,
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
    webSocketFactory: () => ({ close() {} }),
  });

  const universe = await client.fetchSignalUniverse({
    now,
    config: {
      size: 20,
      rankingMetric: BINANCE_UNIVERSE_RANKING.QUOTE_VOLUME,
    },
  });

  assert.deepEqual(requests, [
    "https://api.binance.com/api/v3/ticker/24hr",
    "https://api.binance.com/api/v3/exchangeInfo",
  ]);
  assert.deepEqual(universe.symbols, ["BTCUSDT", "ETHUSDT"]);
  assert.equal(universe.markets[0].rank, 1);
  assert.equal(universe.markets[0].rankingValue, 1500000000);
});
