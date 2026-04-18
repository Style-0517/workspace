import test from "node:test";
import assert from "node:assert/strict";

import { getMarketFocusPanelMarkup } from "../src/components/marketFocusPanel.js";
import { createSignalRouteChartPanel } from "../src/data/chartPanels.js";
import { createConfirmedSignalNavigationPayload } from "../src/features/alerts/confirmedSignalAlert.js";
import {
  createConfirmedSignalRouteState,
  createIdleConfirmedSignalRouteState,
} from "../src/features/alerts/confirmedSignalRouteState.js";

test("market focus 패널은 idle 상태에서 기본 패널 선택 정보를 보여준다", () => {
  const markup = getMarketFocusPanelMarkup({
    panel: createSignalRouteChartPanel({
      symbol: "BTCUSDT",
      timeframe: "5m",
    }),
    routeState: createIdleConfirmedSignalRouteState(),
  });

  assert.ok(markup.includes("MARKET FOCUS"));
  assert.ok(markup.includes("BTCUSDT"));
  assert.ok(markup.includes("5분봉"));
  assert.ok(markup.includes("기본 시장 보기"));
  assert.ok(markup.includes("route 대기 중"));
});

test("market focus 패널은 개요에 없는 routed 코인과 시간봉을 전용 포커스 뷰로 표시한다", () => {
  const routeState = createConfirmedSignalRouteState(
    createConfirmedSignalNavigationPayload({
      alertId: "orb-501",
      symbol: "SOLUSDT",
      timeframe: "3m",
      formulaId: "opening-range-breakout-1m",
    }),
  );

  const markup = getMarketFocusPanelMarkup({
    panel: routeState.focusedPanel,
    routeState,
    navigationMeta: {
      source: "notification-tap",
    },
    usesDedicatedFeed: true,
  });

  assert.ok(markup.includes("SOLUSDT"));
  assert.ok(markup.includes("3분봉"));
  assert.ok(markup.includes("실시간 알림 탭"));
  assert.ok(markup.includes("전용 단일 스트림"));
  assert.ok(markup.includes("SOLUSDT:3m"));
});
