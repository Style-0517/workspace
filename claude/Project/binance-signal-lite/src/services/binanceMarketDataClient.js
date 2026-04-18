import {
  BINANCE_REST_BASE_URL,
  BINANCE_STREAM_BASE_URL,
  STREAM_SUBSCRIPTIONS,
} from "../config/binanceStreams.js";
import {
  DEFAULT_BINANCE_UNIVERSE_CONFIG,
  selectBinanceSignalUniverse,
} from "../config/binanceUniverse.js";

export const DEFAULT_KLINE_LIMIT = 500;
export const DEFAULT_RECONNECT_DELAY_MS = 1500;

function resolveFetch(fetchImpl) {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof globalThis.fetch !== "function") {
    throw new Error("Fetch implementation is required");
  }

  return globalThis.fetch.bind(globalThis);
}

function resolveWebSocketFactory(webSocketFactory) {
  if (webSocketFactory) {
    return webSocketFactory;
  }

  if (typeof globalThis.WebSocket !== "function") {
    throw new Error("WebSocket implementation is required");
  }

  return (url) => new globalThis.WebSocket(url);
}

function parseNumber(value) {
  return Number.parseFloat(value);
}

export function createCombinedStreamUrl(
  subscriptions = STREAM_SUBSCRIPTIONS,
  baseUrl = BINANCE_STREAM_BASE_URL,
) {
  if (!subscriptions.length) {
    throw new Error("At least one stream subscription is required");
  }

  const streamPath = subscriptions
    .map(({ streamName }) => streamName)
    .join("/");

  return `${baseUrl}/stream?streams=${streamPath}`;
}

export function createTicker24hrUrl(restBaseUrl = BINANCE_REST_BASE_URL) {
  return new URL("/api/v3/ticker/24hr", restBaseUrl).toString();
}

export function createExchangeInfoUrl(restBaseUrl = BINANCE_REST_BASE_URL) {
  return new URL("/api/v3/exchangeInfo", restBaseUrl).toString();
}

export function createKlinesUrl({
  symbol,
  interval,
  limit = DEFAULT_KLINE_LIMIT,
  restBaseUrl = BINANCE_REST_BASE_URL,
}) {
  const url = new URL("/api/v3/klines", restBaseUrl);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

export function mapRestKline(entry) {
  return {
    openTime: entry[0],
    open: parseNumber(entry[1]),
    high: parseNumber(entry[2]),
    low: parseNumber(entry[3]),
    close: parseNumber(entry[4]),
    volume: parseNumber(entry[5]),
    closeTime: entry[6],
    quoteVolume: parseNumber(entry[7]),
    tradeCount: entry[8],
    takerBuyBaseVolume: parseNumber(entry[9]),
    takerBuyQuoteVolume: parseNumber(entry[10]),
  };
}

export function normalizeKlinePayload(message) {
  const payload = message.data ?? message;

  if (!payload || payload.e !== "kline" || !payload.k) {
    throw new Error("Expected a Binance kline payload");
  }

  const { k } = payload;
  const streamName = message.stream ?? `${k.s.toLowerCase()}@kline_${k.i}`;

  return {
    streamName,
    symbol: k.s,
    interval: k.i,
    eventTime: payload.E,
    openTime: k.t,
    closeTime: k.T,
    open: parseNumber(k.o),
    high: parseNumber(k.h),
    low: parseNumber(k.l),
    close: parseNumber(k.c),
    volume: parseNumber(k.v),
    quoteVolume: parseNumber(k.q),
    tradeCount: k.n,
    takerBuyBaseVolume: parseNumber(k.V),
    takerBuyQuoteVolume: parseNumber(k.Q),
    isClosed: k.x,
  };
}

export function normalizeMiniTickerPayload(message) {
  const payload = message.data ?? message;

  if (!payload || payload.e !== "24hrMiniTicker" || !payload.s) {
    throw new Error("Expected a Binance mini ticker payload");
  }

  const streamName = message.stream ?? `${payload.s.toLowerCase()}@miniTicker`;

  return {
    streamName,
    symbol: payload.s,
    eventTime: payload.E,
    closePrice: parseNumber(payload.c),
    openPrice: parseNumber(payload.o),
    highPrice: parseNumber(payload.h),
    lowPrice: parseNumber(payload.l),
    baseVolume: parseNumber(payload.v),
    quoteVolume: parseNumber(payload.q),
  };
}

export class BinanceMarketDataClient {
  #fetchImpl;

  #webSocketFactory;

  #restBaseUrl;

  #streamBaseUrl;

  #subscriptions;

  #reconnectDelayMs;

  #socket = null;

  #reconnectTimer = null;

  #shouldReconnect = false;

  constructor({
    fetchImpl,
    webSocketFactory,
    restBaseUrl = BINANCE_REST_BASE_URL,
    streamBaseUrl = BINANCE_STREAM_BASE_URL,
    subscriptions = STREAM_SUBSCRIPTIONS,
    reconnectDelayMs = DEFAULT_RECONNECT_DELAY_MS,
  } = {}) {
    this.#fetchImpl = resolveFetch(fetchImpl);
    this.#webSocketFactory = resolveWebSocketFactory(webSocketFactory);
    this.#restBaseUrl = restBaseUrl;
    this.#streamBaseUrl = streamBaseUrl;
    this.#subscriptions = subscriptions.map((subscription) => ({ ...subscription }));
    this.#reconnectDelayMs = reconnectDelayMs;
  }

  get streamNames() {
    return this.#subscriptions.map(({ streamName }) => streamName);
  }

  get subscriptions() {
    return this.#subscriptions.map((subscription) => ({ ...subscription }));
  }

  get combinedStreamUrl() {
    return createCombinedStreamUrl(this.#subscriptions, this.#streamBaseUrl);
  }

  setSubscriptions(subscriptions = []) {
    if (this.#socket) {
      throw new Error("Cannot update subscriptions while connected");
    }

    this.#subscriptions = subscriptions.map((subscription) => ({ ...subscription }));
    return this.subscriptions;
  }

  async fetchTicker24hr({ signal } = {}) {
    const response = await this.#fetchImpl(createTicker24hrUrl(this.#restBaseUrl), {
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch 24hr tickers: ${response.status}`);
    }

    return response.json();
  }

  async fetchExchangeInfo({ signal } = {}) {
    const response = await this.#fetchImpl(
      createExchangeInfoUrl(this.#restBaseUrl),
      { signal },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch exchange info: ${response.status}`);
    }

    return response.json();
  }

  async fetchSignalUniverse({
    config = DEFAULT_BINANCE_UNIVERSE_CONFIG,
    signal,
    now,
  } = {}) {
    const [tickers24h, exchangeInfo] = await Promise.all([
      this.fetchTicker24hr({ signal }),
      this.fetchExchangeInfo({ signal }),
    ]);

    return selectBinanceSignalUniverse({
      tickers24h,
      exchangeInfoSymbols: exchangeInfo.symbols ?? [],
      config,
      now,
    });
  }

  async fetchSeedKlines({ symbol, interval, limit = DEFAULT_KLINE_LIMIT, signal }) {
    const response = await this.#fetchImpl(
      createKlinesUrl({
        symbol,
        interval,
        limit,
        restBaseUrl: this.#restBaseUrl,
      }),
      { signal },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch klines: ${response.status}`);
    }

    const data = await response.json();
    return data.map(mapRestKline);
  }

  connect({ onKline, onMiniTicker, onOpen, onClose, onError } = {}) {
    this.#shouldReconnect = true;
    this.#clearReconnectTimer();

    if (this.#socket) {
      return this.#socket;
    }

    if (this.#subscriptions.length === 0) {
      throw new Error("At least one stream subscription is required");
    }

    const socket = this.#webSocketFactory(this.combinedStreamUrl);
    this.#socket = socket;

    socket.onopen = () => {
      onOpen?.({
        subscriptions: this.#subscriptions,
        streamNames: this.streamNames,
      });
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const payload = parsed?.data ?? parsed;

        if (payload?.e === "kline") {
          onKline?.(normalizeKlinePayload(parsed));
          return;
        }

        if (payload?.e === "24hrMiniTicker") {
          onMiniTicker?.(normalizeMiniTickerPayload(parsed));
          return;
        }

        if (Object.hasOwn(payload ?? {}, "result") || Object.hasOwn(payload ?? {}, "id")) {
          return;
        }

        throw new Error("Unsupported Binance stream payload");
      } catch (error) {
        onError?.(error);
      }
    };

    socket.onerror = (event) => {
      onError?.(event instanceof Error ? event : new Error("WebSocket error"));
    };

    socket.onclose = (event) => {
      this.#socket = null;
      onClose?.(event);

      if (this.#shouldReconnect) {
        this.#reconnectTimer = setTimeout(() => {
          this.connect({ onKline, onMiniTicker, onOpen, onClose, onError });
        }, this.#reconnectDelayMs);
      }
    };

    return socket;
  }

  disconnect() {
    this.#shouldReconnect = false;
    this.#clearReconnectTimer();

    if (this.#socket) {
      this.#socket.close();
      this.#socket = null;
    }
  }

  #clearReconnectTimer() {
    if (this.#reconnectTimer) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
  }
}
