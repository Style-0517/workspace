import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserFavoriteMarketStore } from "../src/features/markets/browserFavoriteMarketStore.js";

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("browserFavoriteMarketStore toggles configured symbols and persists them", () => {
  const storage = createMemoryStorage();
  const store = createBrowserFavoriteMarketStore({ storage });

  assert.deepEqual(store.getState().symbols, ["BTCUSDT", "ETHUSDT"]);
  assert.equal(store.includes("BTCUSDT"), true);
  assert.equal(store.toggle("BTCUSDT"), false);
  assert.equal(store.includes("BTCUSDT"), false);
  assert.equal(store.toggle("SOLUSDT"), true);

  const rehydrated = createBrowserFavoriteMarketStore({ storage });
  assert.deepEqual(rehydrated.getState().symbols, ["ETHUSDT", "SOLUSDT"]);
  assert.equal(rehydrated.includes("SOLUSDT"), true);
});

test("browserFavoriteMarketStore ignores unsupported symbols", () => {
  const store = createBrowserFavoriteMarketStore({
    storage: createMemoryStorage(),
  });

  assert.equal(store.toggle("NOTREAL"), false);
  assert.deepEqual(store.getState().symbols, ["BTCUSDT", "ETHUSDT"]);
});
