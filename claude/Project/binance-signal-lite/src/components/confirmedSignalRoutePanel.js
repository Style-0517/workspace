import {
  MARKET_OVERVIEW_SCREEN,
  createIdleConfirmedSignalRouteState,
} from "../features/alerts/confirmedSignalRouteState.js";
import { getTradingFormulaById } from "../features/trading-formulas/trading-formulas.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getTimeframeLabel(timeframe) {
  if (!timeframe) {
    return "시간봉 대기";
  }

  return `${timeframe.replace("m", "")}분봉`;
}

function getNavigationSourceLabel(source) {
  switch (source) {
    case "launch-payload":
      return "종료 상태 알림 진입";
    case "location-deep-link":
      return "딥링크 재개";
    case "pending-storage":
      return "보관된 알림 복원";
    case "notification-tap":
      return "실시간 알림 탭";
    default:
      return "확정 시그널 대기";
  }
}

export function getConfirmedSignalRoutePanelMarkup({
  routeState = createIdleConfirmedSignalRouteState(),
  navigationMeta = {},
} = {}) {
  if (routeState.screen === MARKET_OVERVIEW_SCREEN || !routeState.navigationPayload) {
    return `
      <div class="signal-route-panel__content">
        <div>
          <p class="signal-route-panel__eyebrow">ALERT ROUTING</p>
          <h2>확정 시그널 알림 대기</h2>
          <p class="signal-route-panel__description">
            서버가 보낸 확정 시그널 알림을 탭하면 앱이 즉시 열리거나 재개되고, 대상 코인/시간봉 뷰로 바로 이동합니다.
          </p>
        </div>
        <div class="signal-route-panel__meta" aria-label="알림 라우팅 상태">
          <span>백그라운드 재개 지원</span>
          <span>콜드 스타트 payload 소비</span>
        </div>
      </div>
    `;
  }

  const formula = routeState.formulaId
    ? getTradingFormulaById(routeState.formulaId)
    : null;
  const matchLabel = routeState.hasExactPanelMatch
    ? `${escapeHtml(routeState.symbol)} ${escapeHtml(getTimeframeLabel(routeState.timeframe))} 차트 포커스 완료`
    : `${escapeHtml(routeState.symbol)} ${escapeHtml(getTimeframeLabel(routeState.timeframe))} 시장 포커스 뷰 열림`;

  return `
    <div class="signal-route-panel__content">
      <div>
        <p class="signal-route-panel__eyebrow">ACTIVE SIGNAL ROUTE</p>
        <h2>${escapeHtml(routeState.symbol)} · ${escapeHtml(getTimeframeLabel(routeState.timeframe))}</h2>
        <p class="signal-route-panel__description">
          ${escapeHtml(matchLabel)}
        </p>
      </div>
      <div class="signal-route-panel__meta" aria-label="활성 확정 시그널 요약">
        <span>${escapeHtml(getNavigationSourceLabel(navigationMeta.source))}</span>
        <span>alertId: ${escapeHtml(routeState.navigationPayload.params.alertId)}</span>
        <span>${escapeHtml(formula?.name ?? "공식 정보 없음")}</span>
      </div>
    </div>
  `;
}

export function createConfirmedSignalRoutePanel() {
  const panel = document.createElement("section");
  panel.className = "signal-route-panel";
  panel.setAttribute("aria-live", "polite");

  let routeState = createIdleConfirmedSignalRouteState();
  let navigationMeta = {};

  const render = () => {
    panel.innerHTML = getConfirmedSignalRoutePanelMarkup({
      routeState,
      navigationMeta,
    });
  };

  panel.setRouteState = (nextRouteState, nextNavigationMeta = {}) => {
    routeState = nextRouteState ?? createIdleConfirmedSignalRouteState();
    navigationMeta = nextNavigationMeta;
    render();
  };

  render();

  return panel;
}
