import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_BINANCE_UNIVERSE_CONFIG,
  selectBinanceSignalUniverse,
} from "../src/config/binanceUniverse.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

test("selectBinanceSignalUniverse keeps only eligible Binance Spot USDT pairs", () => {
  const now = Date.UTC(2026, 3, 12);
  const oldListingDate = now - 45 * DAY_IN_MS;
  const newListingDate = now - 5 * DAY_IN_MS;

  const universe = selectBinanceSignalUniverse({
    now,
    config: {
      ...DEFAULT_BINANCE_UNIVERSE_CONFIG,
      size: 20,
    },
    exchangeInfoSymbols: [
      {
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        status: "TRADING",
        isSpotTradingAllowed: true,
        onboardDate: oldListingDate,
      },
      {
        symbol: "ETHUSDT",
        baseAsset: "ETH",
        quoteAsset: "USDT",
        status: "TRADING",
        isSpotTradingAllowed: true,
        onboardDate: oldListingDate,
      },
      {
        symbol: "USDCUSDT",
        baseAsset: "USDC",
        quoteAsset: "USDT",
        status: "TRADING",
        isSpotTradingAllowed: true,
        onboardDate: oldListingDate,
      },
      {
        symbol: "BTCDOWNUSDT",
        baseAsset: "BTCDOWN",
        quoteAsset: "USDT",
        status: "TRADING",
        isSpotTradingAllowed: true,
        onboardDate: oldListingDate,
      },
      {
        symbol: "NEWUSDT",
        baseAsset: "NEW",
        quoteAsset: "USDT",
        status: "TRADING",
        isSpotTradingAllowed: true,
        onboardDate: newListingDate,
      },
      {
        symbol: "XRPUSDT",
        baseAsset: "XRP",
        quoteAsset: "USDT",
        status: "BREAK",
        isSpotTradingAllowed: true,
        onboardDate: oldListingDate,
      },
    ],
    tickers24h: [
      {
        symbol: "BTCUSDT",
        lastPrice: "68000.0",
        volume: "1200",
        quoteVolume: "81600000",
        count: 5000,
      },
      {
        symbol: "ETHUSDT",
        lastPrice: "3500.0",
        volume: "9000",
        quoteVolume: "31500000",
        count: 6200,
      },
      {
        symbol: "USDCUSDT",
        lastPrice: "0.9998",
        volume: "1000000",
        quoteVolume: "999800",
        count: 8000,
      },
      {
        symbol: "BTCDOWNUSDT",
        lastPrice: "0.52",
        volume: "200000",
        quoteVolume: "104000",
        count: 2300,
      },
      {
        symbol: "NEWUSDT",
        lastPrice: "1.2",
        volume: "100000",
        quoteVolume: "120000",
        count: 1400,
      },
      {
        symbol: "XRPUSDT",
        lastPrice: "0.55",
        volume: "800000",
        quoteVolume: "440000",
        count: 3100,
      },
    ],
  });

  assert.deepEqual(universe.symbols, ["BTCUSDT", "ETHUSDT"]);
  assert.equal(universe.markets[0].rank, 1);
  assert.equal(universe.markets[0].quoteVolume, 81_600_000);
  assert.equal(universe.markets[1].symbol, "ETHUSDT");
});
