import {
  DEFAULT_FAVORITE_SYMBOLS,
  isConfiguredMarketSymbol,
} from "../../config/marketCatalog.js";
import { FAVORITE_MARKET_STORAGE_KEY } from "../../config/localStateStorage.js";

function cloneState(state) {
  return {
    symbols: [...state.symbols],
  };
}

function normalizeSymbols(symbols = [], fallbackSymbols = DEFAULT_FAVORITE_SYMBOLS) {
  if (!Array.isArray(symbols)) {
    return normalizeSymbols(fallbackSymbols, []);
  }

  const normalizedSymbols = [...new Set(
    symbols
      .map((symbol) => (typeof symbol === "string" ? symbol.trim().toUpperCase() : ""))
      .filter((symbol) => isConfiguredMarketSymbol(symbol)),
  )];

  return normalizedSymbols.length > 0 || symbols.length === 0
    ? normalizedSymbols
    : normalizeSymbols(fallbackSymbols, []);
}

function createInitialState(defaultSymbols = DEFAULT_FAVORITE_SYMBOLS) {
  return {
    symbols: normalizeSymbols(defaultSymbols, DEFAULT_FAVORITE_SYMBOLS),
  };
}

function parseStoredState(rawValue, defaultSymbols) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return createInitialState(defaultSymbols);
  }

  try {
    const parsed = JSON.parse(rawValue);
    const symbols = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.symbols)
        ? parsed.symbols
        : [];

    return {
      symbols: normalizeSymbols(symbols, defaultSymbols),
    };
  } catch {
    return createInitialState(defaultSymbols);
  }
}

function persistState(storage, storageKey, state) {
  if (typeof storage?.setItem !== "function") {
    return false;
  }

  storage.setItem(storageKey, JSON.stringify(state.symbols));
  return true;
}

export function createBrowserFavoriteMarketStore({
  storage = null,
  storageKey = FAVORITE_MARKET_STORAGE_KEY,
  defaultSymbols = DEFAULT_FAVORITE_SYMBOLS,
} = {}) {
  const listeners = new Set();
  let state = parseStoredState(
    typeof storage?.getItem === "function" ? storage.getItem(storageKey) : null,
    defaultSymbols,
  );

  const emit = () => {
    const snapshot = cloneState(state);
    listeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const commit = (nextState) => {
    state = nextState;
    persistState(storage, storageKey, state);
    emit();
  };

  return {
    subscribe(listener, { emitCurrent = true } = {}) {
      listeners.add(listener);

      if (emitCurrent) {
        listener(cloneState(state));
      }

      return () => {
        listeners.delete(listener);
      };
    },

    getState() {
      return cloneState(state);
    },

    includes(symbol) {
      if (typeof symbol !== "string") {
        return false;
      }

      return state.symbols.includes(symbol.trim().toUpperCase());
    },

    toggle(symbol) {
      if (!isConfiguredMarketSymbol(symbol)) {
        return false;
      }

      const normalizedSymbol = symbol.trim().toUpperCase();
      const hasSymbol = state.symbols.includes(normalizedSymbol);

      commit({
        symbols: hasSymbol
          ? state.symbols.filter((item) => item !== normalizedSymbol)
          : [...state.symbols, normalizedSymbol],
      });

      return !hasSymbol;
    },

    setSymbols(symbols) {
      const nextSymbols = normalizeSymbols(symbols, []);

      if (
        nextSymbols.length === state.symbols.length &&
        nextSymbols.every((symbol, index) => symbol === state.symbols[index])
      ) {
        return cloneState(state);
      }

      commit({
        symbols: nextSymbols,
      });

      return cloneState(state);
    },

    reset() {
      commit(createInitialState(defaultSymbols));
      return cloneState(state);
    },
  };
}
