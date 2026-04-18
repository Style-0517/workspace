import {
  DEFAULT_ACTIVE_TIMEFRAME,
  MONITORING_TIMEFRAMES,
  getMonitoringTimeframeLabel,
} from "../config/monitoringTimeframes.js";
import { MARKET_SYMBOLS } from "../config/marketCatalog.js";
import { isSupportedInterval, isSupportedSymbol } from "../config/binanceStreams.js";

export const CHART_PANEL_SYMBOLS = MARKET_SYMBOLS;
export const DEFAULT_CHART_PANEL_TIMEFRAMES = Object.freeze(["1m", "5m"]);

const PANEL_ACCENTS = Object.freeze({
  "BTCUSDT:1m": "#f4a261",
  "BTCUSDT:3m": "#e9c46a",
  "BTCUSDT:5m": "#2a9d8f",
  "BTCUSDT:15m": "#457b9d",
  "ETHUSDT:1m": "#e76f51",
  "ETHUSDT:3m": "#c77dff",
  "ETHUSDT:5m": "#264653",
  "ETHUSDT:15m": "#8ecae6",
});

const PANEL_STATUS_BY_TIMEFRAME = Object.freeze({
  "1m": "초단타 진입 패턴 감시",
  "3m": "노이즈 축소 확인 레이어",
  "5m": "추세 확인 레이어",
  "15m": "상위 추세 컨텍스트",
});

function normalizeChartSymbol(symbol) {
  if (typeof symbol !== "string") {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }

  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!isSupportedSymbol(normalizedSymbol)) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }

  return normalizedSymbol;
}

function createChartPanelRouteKey({ symbol, timeframe }) {
  return `${normalizeChartSymbol(symbol)}:${normalizePanelTimeframe(timeframe)}`;
}

function normalizeSymbols(symbols = CHART_PANEL_SYMBOLS) {
  return [...new Set(symbols.map((symbol) => normalizeChartSymbol(symbol)))];
}

function normalizePanelTimeframe(timeframe = DEFAULT_ACTIVE_TIMEFRAME) {
  if (typeof timeframe !== "string") {
    return DEFAULT_ACTIVE_TIMEFRAME;
  }

  const normalizedTimeframe = timeframe.trim().toLowerCase();

  if (!isSupportedInterval(normalizedTimeframe)) {
    return DEFAULT_ACTIVE_TIMEFRAME;
  }

  return normalizedTimeframe;
}

function normalizeTimeframes(timeframes = DEFAULT_CHART_PANEL_TIMEFRAMES) {
  return [...new Set(timeframes)].map((timeframe) =>
    normalizePanelTimeframe(timeframe),
  );
}

function createPanel(symbol, timeframe) {
  const normalizedSymbol = normalizeChartSymbol(symbol);
  const normalizedTimeframe = normalizePanelTimeframe(timeframe);
  const routeKey = createChartPanelRouteKey({
    symbol: normalizedSymbol,
    timeframe: normalizedTimeframe,
  });

  return Object.freeze({
    symbol: normalizedSymbol,
    timeframe: normalizedTimeframe,
    marketLabel: `${normalizedSymbol} ${getMonitoringTimeframeLabel(normalizedTimeframe)}`,
    accent: PANEL_ACCENTS[routeKey] ?? "#9dcab9",
    status: PANEL_STATUS_BY_TIMEFRAME[normalizedTimeframe] ?? "실시간 감시",
    routeKey,
  });
}

export function createChartPanels({
  timeframe = DEFAULT_ACTIVE_TIMEFRAME,
  symbols = CHART_PANEL_SYMBOLS,
} = {}) {
  const normalizedTimeframe = normalizePanelTimeframe(timeframe);

  return Object.freeze(
    normalizeSymbols(symbols).map((symbol) =>
      createPanel(symbol, normalizedTimeframe),
    ),
  );
}

export function createMonitoringChartPanels({
  symbols = CHART_PANEL_SYMBOLS,
  timeframes = MONITORING_TIMEFRAMES,
} = {}) {
  const normalizedSymbols = normalizeSymbols(symbols);
  const normalizedTimeframes = normalizeTimeframes(timeframes);

  return Object.freeze(
    normalizedSymbols.flatMap((symbol) =>
      normalizedTimeframes.map((timeframe) => createPanel(symbol, timeframe)),
    ),
  );
}

export const chartPanels = createMonitoringChartPanels({
  timeframes: DEFAULT_CHART_PANEL_TIMEFRAMES,
});

export { createChartPanelRouteKey };

export function getChartPanelByRouteKey(
  routeKey,
  panels = chartPanels,
) {
  return panels.find((panel) => panel.routeKey === routeKey) ?? null;
}

export function createSignalRouteChartPanel({
  symbol,
  timeframe,
} = {}) {
  return createPanel(symbol, timeframe);
}

export function resolveChartPanel(
  { symbol, timeframe },
  panels = chartPanels,
) {
  const routeKey = createChartPanelRouteKey({ symbol, timeframe });

  return (
    getChartPanelByRouteKey(routeKey, panels) ??
    createSignalRouteChartPanel({ symbol, timeframe })
  );
}
