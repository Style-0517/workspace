import test from "node:test";
import assert from "node:assert/strict";

import {
  CHART_PANEL_SYMBOLS,
  chartPanels,
  createChartPanels,
  createSignalRouteChartPanel,
  createMonitoringChartPanels,
  createChartPanelRouteKey,
  getChartPanelByRouteKey,
  resolveChartPanel,
} from "../src/data/chartPanels.js";

test("차트 레이아웃은 기본 지원 종목의 1분봉·5분봉 패널을 모두 포함한다", () => {
  assert.equal(chartPanels.length, CHART_PANEL_SYMBOLS.length * 2);

  assert.deepEqual(
    chartPanels.map(({ symbol, timeframe }) => `${symbol}:${timeframe}`),
    CHART_PANEL_SYMBOLS.flatMap((symbol) => [`${symbol}:1m`, `${symbol}:5m`]),
  );
});

test("활성 시간봉을 바꾸면 기본 지원 종목 패널이 같은 시간봉으로 다시 생성된다", () => {
  const panels = createChartPanels({ timeframe: "15m" });

  assert.deepEqual(
    panels.map(({ symbol, timeframe }) => `${symbol}:${timeframe}`),
    CHART_PANEL_SYMBOLS.map((symbol) => `${symbol}:15m`),
  );
  assert.equal(panels[0].marketLabel, "BTCUSDT 15분봉");
  assert.equal(panels.at(-1)?.status, "상위 추세 컨텍스트");
});

test("모니터링 패널 생성기는 경량 앱 기본값으로 1m·5m만 만든다", () => {
  const panels = createMonitoringChartPanels();

  assert.equal(panels.length, CHART_PANEL_SYMBOLS.length * 2);
  assert.deepEqual(
    panels.map(({ routeKey }) => routeKey),
    CHART_PANEL_SYMBOLS.flatMap((symbol) => [`${symbol}:1m`, `${symbol}:5m`]),
  );
});

test("모니터링 패널 생성기는 timeframes 인자를 주면 3m·15m까지 확장할 수 있다", () => {
  const panels = createMonitoringChartPanels({
    timeframes: ["1m", "3m", "5m", "15m"],
  });

  assert.equal(panels.length, CHART_PANEL_SYMBOLS.length * 4);
  assert.deepEqual(
    panels.map(({ routeKey }) => routeKey),
    CHART_PANEL_SYMBOLS.flatMap((symbol) => [
      `${symbol}:1m`,
      `${symbol}:3m`,
      `${symbol}:5m`,
      `${symbol}:15m`,
    ]),
  );
});

test("차트 레이아웃 패널은 표시용 제목과 상태 문구를 가진다", () => {
  for (const panel of chartPanels) {
    assert.ok(panel.marketLabel);
    assert.ok(panel.status);
    assert.match(panel.timeframe, /^(1m|5m)$/);
    assert.ok(CHART_PANEL_SYMBOLS.includes(panel.symbol));
    assert.equal(panel.routeKey, createChartPanelRouteKey(panel));
  }
});

test("routeKey로 차트 패널을 조회할 수 있다", () => {
  const panel = getChartPanelByRouteKey("ETHUSDT:5m");

  assert.ok(panel);
  assert.equal(panel.symbol, "ETHUSDT");
  assert.equal(panel.timeframe, "5m");
});

test("routed 코인과 시간봉은 개요 패널 밖에서도 시장 포커스용 패널로 생성된다", () => {
  const panel = createSignalRouteChartPanel({
    symbol: "solusdt",
    timeframe: "15m",
  });

  assert.equal(panel.symbol, "SOLUSDT");
  assert.equal(panel.timeframe, "15m");
  assert.equal(panel.routeKey, "SOLUSDT:15m");
  assert.equal(panel.marketLabel, "SOLUSDT 15분봉");
});

test("route 해석은 개요 패널이 있으면 재사용하고 없으면 동적 패널로 폴백한다", () => {
  const matchedPanel = resolveChartPanel({
    symbol: "BTCUSDT",
    timeframe: "1m",
  });
  const routedPanel = resolveChartPanel({
    symbol: "XRPUSDT",
    timeframe: "3m",
  });

  assert.equal(matchedPanel, chartPanels[0]);
  assert.equal(routedPanel.symbol, "XRPUSDT");
  assert.equal(routedPanel.timeframe, "3m");
  assert.equal(routedPanel.routeKey, "XRPUSDT:3m");
});
