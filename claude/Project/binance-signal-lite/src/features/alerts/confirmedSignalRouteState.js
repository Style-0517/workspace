import { deepFreeze } from "../../shared/deep-freeze.js";
import {
  chartPanels,
  getChartPanelByRouteKey,
  resolveChartPanel,
} from "../../data/chartPanels.js";
import { ALERT_DEEP_LINK_SCREEN } from "./confirmedSignalAlert.js";

export const MARKET_OVERVIEW_SCREEN = "market-overview";
export const SIGNAL_DETAIL_SCREEN = ALERT_DEEP_LINK_SCREEN;

export function createIdleConfirmedSignalRouteState() {
  return deepFreeze({
    screen: MARKET_OVERVIEW_SCREEN,
    routeKey: null,
    symbol: null,
    timeframe: null,
    formulaId: null,
    navigationPayload: null,
    matchedPanel: null,
    focusedPanel: null,
    hasExactPanelMatch: false,
  });
}

export function createConfirmedSignalRouteState(
  navigationPayload,
  panels = chartPanels,
) {
  const matchedPanel = getChartPanelByRouteKey(
    navigationPayload.routeKey,
    panels,
  );
  const focusedPanel = resolveChartPanel({
    symbol: navigationPayload.params.symbol,
    timeframe: navigationPayload.params.timeframe,
  }, panels);

  return deepFreeze({
    screen: SIGNAL_DETAIL_SCREEN,
    routeKey: navigationPayload.routeKey,
    symbol: navigationPayload.params.symbol,
    timeframe: navigationPayload.params.timeframe,
    formulaId: navigationPayload.params.formulaId,
    navigationPayload,
    matchedPanel,
    focusedPanel,
    hasExactPanelMatch: Boolean(matchedPanel),
  });
}
