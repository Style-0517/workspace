import test from "node:test";
import assert from "node:assert/strict";

import { createConfirmedSignalNavigationPayload } from "../src/features/alerts/confirmedSignalAlert.js";
import {
  MARKET_OVERVIEW_SCREEN,
  SIGNAL_DETAIL_SCREEN,
  createConfirmedSignalRouteState,
  createIdleConfirmedSignalRouteState,
} from "../src/features/alerts/confirmedSignalRouteState.js";

test("기본 route state는 마켓 개요 화면을 가리킨다", () => {
  const routeState = createIdleConfirmedSignalRouteState();

  assert.equal(routeState.screen, MARKET_OVERVIEW_SCREEN);
  assert.equal(routeState.navigationPayload, null);
  assert.equal(routeState.focusedPanel, null);
  assert.equal(routeState.hasExactPanelMatch, false);
});

test("확정 시그널 payload는 일치하는 차트 패널로 route state를 만든다", () => {
  const routeState = createConfirmedSignalRouteState(
    createConfirmedSignalNavigationPayload({
      alertId: "ema-404",
      symbol: "BTCUSDT",
      timeframe: "1m",
      formulaId: "ema-pullback-reclaim-1m",
    }),
  );

  assert.equal(routeState.screen, SIGNAL_DETAIL_SCREEN);
  assert.equal(routeState.routeKey, "BTCUSDT:1m");
  assert.equal(routeState.hasExactPanelMatch, true);
  assert.equal(routeState.matchedPanel?.marketLabel, "BTCUSDT 1분봉");
  assert.equal(routeState.focusedPanel?.routeKey, "BTCUSDT:1m");
});

test("개요 차트에 없는 코인/시간봉도 routed 포커스 패널과 함께 route state로 표현된다", () => {
  const routeState = createConfirmedSignalRouteState(
    createConfirmedSignalNavigationPayload({
      alertId: "ema-405",
      symbol: "XRPUSDT",
      timeframe: "15m",
      formulaId: "ema-pullback-reclaim-1m",
    }),
  );

  assert.equal(routeState.screen, SIGNAL_DETAIL_SCREEN);
  assert.equal(routeState.routeKey, "XRPUSDT:15m");
  assert.equal(routeState.hasExactPanelMatch, false);
  assert.equal(routeState.matchedPanel, null);
  assert.equal(routeState.focusedPanel?.routeKey, "XRPUSDT:15m");
  assert.equal(routeState.focusedPanel?.marketLabel, "XRPUSDT 15분봉");
});
