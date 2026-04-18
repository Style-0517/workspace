import test from "node:test";
import assert from "node:assert/strict";

import {
  ALERT_DEEP_LINK_SCHEME,
  ALERT_DEEP_LINK_SCREEN,
  ALERT_NAVIGATION_PAYLOAD_VERSION,
  createConfirmedSignalAlert,
  createConfirmedSignalDeepLink,
  createConfirmedSignalNavigationPayload,
  parseConfirmedSignalDeepLink,
} from "../src/features/alerts/confirmedSignalAlert.js";

test("confirmed signal navigation payload includes symbol and timeframe for APK routing", () => {
  const payload = createConfirmedSignalNavigationPayload({
    alertId: "ema-001",
    symbol: "btcusdt",
    timeframe: "1m",
    formulaId: "ema-pullback-reclaim-1m",
  });

  assert.deepEqual(payload, {
    version: ALERT_NAVIGATION_PAYLOAD_VERSION,
    screen: ALERT_DEEP_LINK_SCREEN,
    routeKey: "BTCUSDT:1m",
    params: {
      alertId: "ema-001",
      symbol: "BTCUSDT",
      timeframe: "1m",
      formulaId: "ema-pullback-reclaim-1m",
    },
  });
});

test("confirmed signal deep link exposes symbol and timeframe query params", () => {
  const deepLink = createConfirmedSignalDeepLink({
    alertId: "orb-002",
    symbol: "ETHUSDT",
    timeframe: "15m",
    formulaId: "opening-range-breakout-1m",
  });
  const parsedUrl = new URL(deepLink);

  assert.equal(deepLink.startsWith(`${ALERT_DEEP_LINK_SCHEME}://`), true);
  assert.equal(parsedUrl.protocol, `${ALERT_DEEP_LINK_SCHEME}:`);
  assert.equal(parsedUrl.hostname, ALERT_DEEP_LINK_SCREEN);
  assert.equal(parsedUrl.searchParams.get("alertId"), "orb-002");
  assert.equal(parsedUrl.searchParams.get("symbol"), "ETHUSDT");
  assert.equal(parsedUrl.searchParams.get("timeframe"), "15m");
  assert.equal(
    parsedUrl.searchParams.get("formulaId"),
    "opening-range-breakout-1m",
  );
});

test("deep link round-trips back into the same navigation payload", () => {
  const deepLink = createConfirmedSignalDeepLink({
    alertId: "rev-003",
    symbol: "BTCUSDT",
    timeframe: "5m",
    formulaId: "bollinger-squeeze-breakout-5m",
  });

  assert.deepEqual(parseConfirmedSignalDeepLink(deepLink), {
    version: ALERT_NAVIGATION_PAYLOAD_VERSION,
    screen: ALERT_DEEP_LINK_SCREEN,
    routeKey: "BTCUSDT:5m",
    params: {
      alertId: "rev-003",
      symbol: "BTCUSDT",
      timeframe: "5m",
      formulaId: "bollinger-squeeze-breakout-5m",
    },
  });
});

test("confirmed signal alert embeds the same navigation payload and deep link", () => {
  const alert = createConfirmedSignalAlert({
    alertId: "ema-004",
    symbol: "BTCUSDT",
    timeframe: "3m",
    formulaId: "ema-pullback-reclaim-1m",
    signalType: "trend-continuation",
    direction: "long",
    entryPrice: 104.9,
    stopLoss: 103.35,
    takeProfit: 107.69,
    rationale: "9EMA reclaim confirmed on candle close",
    confirmedAt: "2026-04-12T09:30:00.000Z",
  });

  assert.equal(alert.symbol, "BTCUSDT");
  assert.equal(alert.timeframe, "3m");
  assert.equal(alert.entryPrice, 104.9);
  assert.equal(alert.stopLoss, 103.35);
  assert.equal(alert.takeProfit, 107.69);
  assert.equal(alert.navigation.params.symbol, "BTCUSDT");
  assert.equal(alert.navigation.params.timeframe, "3m");
  assert.equal(
    alert.navigation.deepLink,
    "binance-signal-lite://signal-detail?alertId=ema-004&symbol=BTCUSDT&timeframe=3m&formulaId=ema-pullback-reclaim-1m",
  );
  assert.equal(alert.confirmedAt, "2026-04-12T09:30:00.000Z");
});

test("confirmed signal alert requires complete trade levels when one is provided", () => {
  assert.throws(() => {
    createConfirmedSignalAlert({
      alertId: "ema-005",
      symbol: "BTCUSDT",
      timeframe: "1m",
      signalType: "trend-continuation",
      entryPrice: 100.5,
      stopLoss: 99.9,
    });
  }, /must be provided together/);
});

test("confirmed signal payload rejects missing symbol or unsupported timeframe", () => {
  assert.throws(() => {
    createConfirmedSignalNavigationPayload({
      alertId: "missing-symbol",
      symbol: "",
      timeframe: "1m",
    });
  }, /symbol must be a non-empty string/);

  assert.throws(() => {
    createConfirmedSignalNavigationPayload({
      alertId: "bad-timeframe",
      symbol: "BTCUSDT",
      timeframe: "30m",
    });
  }, /Unsupported timeframe: 30m/);
});
