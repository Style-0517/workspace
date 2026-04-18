import { createStreamSubscriptions, SUPPORTED_INTERVALS } from "../../config/binanceStreams.js";
import { DEFAULT_BINANCE_UNIVERSE_CONFIG } from "../../config/binanceUniverse.js";
import {
  BinanceMarketDataClient,
  DEFAULT_KLINE_LIMIT,
} from "../../services/binanceMarketDataClient.js";
import { createLatestSignalCandleState } from "./latestSignalCandleState.js";
import { createRealtimeCandleStore } from "./realtimeCandleStore.js";

export const SIGNAL_UNIVERSE_INTERVALS = Object.freeze([...SUPPORTED_INTERVALS]);

function cloneUniverse(universe) {
  if (!universe) {
    return null;
  }

  return {
    ...universe,
    symbols: [...(universe.symbols ?? [])],
    markets: (universe.markets ?? []).map((market) => ({ ...market })),
  };
}

function cloneSubscriptions(client) {
  return Array.isArray(client?.subscriptions)
    ? client.subscriptions.map((subscription) => ({ ...subscription }))
    : [];
}

function createSnapshot({ client, store, universe, asOf = Date.now() }) {
  const marketData = store?.getState() ?? null;
  const subscriptions = cloneSubscriptions(client);

  return {
    universe: cloneUniverse(universe),
    marketData,
    subscriptions,
    streamNames: Array.isArray(client?.streamNames) ? [...client.streamNames] : [],
    latestCandleState: createLatestSignalCandleState({
      marketData,
      subscriptions,
      asOf,
    }),
  };
}

export function createSignalUniverseMarketData({
  client = new BinanceMarketDataClient(),
  universeConfig = DEFAULT_BINANCE_UNIVERSE_CONFIG,
  intervals = SIGNAL_UNIVERSE_INTERVALS,
  seedLimit = DEFAULT_KLINE_LIMIT,
  maxCandles = seedLimit,
} = {}) {
  if (!client || typeof client.fetchSignalUniverse !== "function") {
    throw new Error("A Binance market data client with universe support is required");
  }

  if (typeof client.setSubscriptions !== "function") {
    throw new Error("A Binance market data client with subscription updates is required");
  }

  let universe = null;
  let store = null;
  let unsubscribeStore = null;
  const listeners = new Set();

  const emit = () => {
    const snapshot = createSnapshot({ client, store, universe });
    listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  };

  const bindStore = (nextStore) => {
    unsubscribeStore?.();
    unsubscribeStore = null;
    store = nextStore;

    if (!store) {
      return;
    }

    unsubscribeStore = store.subscribe(() => {
      emit();
    });
  };

  const hydrate = async ({ signal, now } = {}) => {
    const nextUniverse = await client.fetchSignalUniverse({
      config: universeConfig,
      signal,
      now,
    });

    store?.disconnect?.();
    client.disconnect?.();

    const subscriptions = createStreamSubscriptions({
      symbols: nextUniverse.symbols,
      intervals,
    });

    client.setSubscriptions(subscriptions);
    universe = nextUniverse;
    bindStore(
      createRealtimeCandleStore({
        client,
        symbols: nextUniverse.symbols,
        intervals,
        seedLimit,
        maxCandles,
      }),
    );

    emit();
    await store.hydrate({ signal });
    return emit();
  };

  const connect = () => {
    if (!store) {
      throw new Error("Hydrate the signal-universe market data before connecting");
    }

    return store.connect();
  };

  const disconnect = () => {
    store?.disconnect();
    return emit();
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    listener(createSnapshot({ client, store, universe }));

    return () => {
      listeners.delete(listener);
    };
  };

  return {
    hydrate,
    connect,
    disconnect,
    subscribe,
    applyKline(kline) {
      return store?.applyKline(kline) ?? false;
    },
    getSnapshot() {
      return createSnapshot({ client, store, universe });
    },
    getLatestCandleState({ now = Date.now() } = {}) {
      return createLatestSignalCandleState({
        marketData: store?.getState() ?? null,
        subscriptions: cloneSubscriptions(client),
        asOf: now,
      });
    },
    getUniverse() {
      return cloneUniverse(universe);
    },
    getMarketDataState() {
      return store?.getState() ?? null;
    },
  };
}
