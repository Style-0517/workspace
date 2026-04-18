import { getMonitoringTimeframeLabel } from "../config/monitoringTimeframes.js";
import { chartPanels } from "../data/chartPanels.js";
import {
  MARKET_OVERVIEW_SCREEN,
  createIdleConfirmedSignalRouteState,
} from "../features/alerts/confirmedSignalRouteState.js";
import { createChartCard } from "./chartCard.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getNavigationSourceLabel(source) {
  switch (source) {
    case "launch-payload":
      return "종료 상태 알림 진입";
    case "location-deep-link":
      return "딥링크 재개";
    case "pending-storage":
      return "보관 알림 복원";
    case "notification-tap":
      return "실시간 알림 탭";
    default:
      return "기본 시장 보기";
  }
}

function getFocusDescription(routeState, usesDedicatedFeed) {
  if (routeState.screen === MARKET_OVERVIEW_SCREEN) {
    return "확정 시그널 알림이 열리면 선택된 코인과 시간봉을 여기서 바로 확인할 수 있습니다.";
  }

  if (usesDedicatedFeed) {
    return "개요 4분할에 없는 조합이라도 routed 코인/시간봉을 전용 뷰로 즉시 열어 둡니다.";
  }

  return "알림 payload와 같은 코인/시간봉이 선택되었고, 개요 차트와 동일한 스트림으로 동기화됩니다.";
}

export function getMarketFocusPanelMarkup({
  panel = chartPanels[0] ?? null,
  routeState = createIdleConfirmedSignalRouteState(),
  navigationMeta = {},
  usesDedicatedFeed = false,
} = {}) {
  const selectedPanel = panel ?? chartPanels[0] ?? null;
  const title = selectedPanel
    ? `${selectedPanel.symbol} · ${getMonitoringTimeframeLabel(selectedPanel.timeframe)}`
    : "시장 포커스 준비 중";

  return `
    <div class="market-focus-panel__header">
      <div>
        <p class="market-focus-panel__eyebrow">MARKET FOCUS</p>
        <h2>${escapeHtml(title)}</h2>
        <p class="market-focus-panel__description">
          ${escapeHtml(getFocusDescription(routeState, usesDedicatedFeed))}
        </p>
      </div>
      <div class="market-focus-panel__selection" aria-label="선택된 코인과 시간봉">
        <span class="market-focus-panel__pill">${escapeHtml(selectedPanel?.symbol ?? "심볼 대기")}</span>
        <span class="market-focus-panel__pill">${escapeHtml(
          selectedPanel
            ? getMonitoringTimeframeLabel(selectedPanel.timeframe)
            : "시간봉 대기",
        )}</span>
      </div>
    </div>
    <div class="market-focus-panel__meta" aria-label="시장 포커스 상태">
      <span>${escapeHtml(getNavigationSourceLabel(navigationMeta.source))}</span>
      <span>${usesDedicatedFeed ? "전용 단일 스트림" : "개요 스트림 공유"}</span>
      <span>${escapeHtml(routeState.routeKey ?? "route 대기 중")}</span>
    </div>
    <div data-role="market-focus-card-slot"></div>
  `;
}

export function createMarketFocusPanel({
  defaultPanel = chartPanels[0] ?? null,
  overviewMarketData = null,
  createDedicatedMarketData = null,
} = {}) {
  const panel = document.createElement("section");
  panel.className = "market-focus-panel";

  let resolvedDefaultPanel = defaultPanel;
  let routeState = createIdleConfirmedSignalRouteState();
  let navigationMeta = {};
  let activePanel = resolvedDefaultPanel;
  let activeCard = null;
  let activeDedicatedMarketData = null;
  let usesDedicatedFeed = false;

  const destroyDedicatedMarketData = () => {
    activeDedicatedMarketData?.stop?.();
    activeDedicatedMarketData = null;
  };

  const ensureCard = (nextPanel, nextUsesDedicatedFeed) => {
    const resolvedPanel = nextPanel ?? resolvedDefaultPanel;

    if (!resolvedPanel) {
      return;
    }

    const shouldReplaceCard =
      !activeCard
      || activePanel?.routeKey !== resolvedPanel.routeKey
      || usesDedicatedFeed !== nextUsesDedicatedFeed;

    activePanel = resolvedPanel;

    if (!shouldReplaceCard) {
      return;
    }

    activeCard?.destroy?.();
    destroyDedicatedMarketData();

    let marketData = overviewMarketData;

    if (nextUsesDedicatedFeed) {
      activeDedicatedMarketData = createDedicatedMarketData?.(resolvedPanel) ?? null;
      marketData = activeDedicatedMarketData;
    }

    activeCard = createChartCard(resolvedPanel, { marketData });

    if (activeDedicatedMarketData) {
      activeDedicatedMarketData.start().catch((error) => {
        console.error("Failed to start focused market feed", error);
      });
    }
  };

  const render = () => {
    const nextUsesDedicatedFeed =
      routeState.screen !== MARKET_OVERVIEW_SCREEN && !routeState.hasExactPanelMatch;
    const nextPanel = routeState.focusedPanel ?? resolvedDefaultPanel;

    ensureCard(nextPanel, nextUsesDedicatedFeed);

    panel.innerHTML = getMarketFocusPanelMarkup({
      panel: activePanel,
      routeState,
      navigationMeta,
      usesDedicatedFeed: nextUsesDedicatedFeed,
    });

    activeCard?.setAlertState?.({
      isMatched: routeState.screen !== MARKET_OVERVIEW_SCREEN,
      navigationPayload: routeState.navigationPayload,
    });

    if (activeCard) {
      panel
        .querySelector('[data-role="market-focus-card-slot"]')
        ?.replaceWith(activeCard);
    }

    usesDedicatedFeed = nextUsesDedicatedFeed;
  };

  panel.setFocusedRoute = (nextRouteState, nextNavigationMeta = {}) => {
    routeState = nextRouteState ?? createIdleConfirmedSignalRouteState();
    navigationMeta = nextNavigationMeta;
    render();
    return activePanel;
  };

  panel.setDefaultPanel = (nextPanel) => {
    if (!nextPanel || nextPanel.routeKey === resolvedDefaultPanel?.routeKey) {
      return false;
    }

    resolvedDefaultPanel = nextPanel;

    if (routeState.screen === MARKET_OVERVIEW_SCREEN) {
      render();
    }

    return true;
  };

  panel.getFocusedPanel = () => activePanel;

  panel.destroy = () => {
    activeCard?.destroy?.();
    destroyDedicatedMarketData();
  };

  render();

  return panel;
}
