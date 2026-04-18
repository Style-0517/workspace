import { formatSeoulDateTime } from "../lib/seoulTime.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrice(value) {
  if (value == null || !Number.isFinite(value)) {
    return "계산 대기";
  }

  if (value >= 10_000) {
    return value.toFixed(2);
  }

  if (value >= 100) {
    return value.toFixed(3);
  }

  if (value >= 1) {
    return value.toFixed(4);
  }

  return value.toFixed(6);
}

function formatDetectedAt(value) {
  return formatSeoulDateTime(value, {
    suffix: true,
    fallback: "시간 대기",
  });
}

function renderAlertItem(alert, selectedAlertId) {
  const isSelected = alert.id === selectedAlertId;

  return `
    <li class="alert-inbox__item${isSelected ? " is-selected" : ""}${alert.status === "new" ? " is-new" : ""}">
      <div class="alert-inbox__item-header">
        <div>
          <p class="alert-inbox__item-symbol">${escapeHtml(alert.symbol)} · ${escapeHtml(alert.timeframe)}</p>
          <strong>${escapeHtml(alert.formulaName)}</strong>
        </div>
        <span class="alert-inbox__item-status">${escapeHtml(
          alert.status === "new" ? "새 신호" : "확인됨",
        )}</span>
      </div>
      <p class="alert-inbox__item-explanation">${escapeHtml(alert.explanation)}</p>
      <dl class="alert-inbox__item-levels">
        <div>
          <dt>진입 참고가</dt>
          <dd>${escapeHtml(formatPrice(alert.entryPrice))}</dd>
        </div>
        <div>
          <dt>손절</dt>
          <dd>${escapeHtml(formatPrice(alert.stopLoss))}</dd>
        </div>
        <div>
          <dt>목표</dt>
          <dd>${escapeHtml(formatPrice(alert.takeProfit))}</dd>
        </div>
      </dl>
      <div class="alert-inbox__item-footer">
        <span>${escapeHtml(formatDetectedAt(alert.detectedAt))}</span>
        <div class="alert-inbox__item-actions">
          <button type="button" data-action="apply" data-alert-id="${escapeHtml(alert.id)}">
            주문에 적용
          </button>
          <button type="button" data-action="acknowledge" data-alert-id="${escapeHtml(alert.id)}">
            확인
          </button>
        </div>
      </div>
    </li>
  `;
}

export function getAlertInboxPanelMarkup({
  alerts = [],
  selectedAlertId = null,
} = {}) {
  const unreadCount = alerts.filter((alert) => alert.status === "new").length;
  const latestAlert = alerts[0] ?? null;

  return `
    <div class="alert-inbox__header">
      <div>
        <p class="alert-inbox__eyebrow">신호</p>
        <h2>매매법 일치 알림</h2>
      </div>
      <div class="alert-inbox__summary">
        <span>누적 ${alerts.length}건</span>
        <span>미확인 ${unreadCount}건</span>
      </div>
    </div>
    <div class="alert-inbox__banner" aria-live="polite">
      ${
        latestAlert
          ? `<strong>${escapeHtml(latestAlert.symbol)} ${escapeHtml(latestAlert.timeframe)}에서 ${escapeHtml(latestAlert.formulaName)} 감지</strong>
             <span>${escapeHtml(formatDetectedAt(latestAlert.detectedAt))}</span>`
          : "<strong>아직 감지된 공식이 없습니다.</strong><span>실시간 차트를 계속 모니터링 중입니다.</span>"
      }
    </div>
    <ul class="alert-inbox__list" aria-label="감지된 공식 알림 이력">
      ${
        alerts.length > 0
          ? alerts.map((alert) => renderAlertItem(alert, selectedAlertId)).join("")
          : '<li class="alert-inbox__empty">신호가 감지되면 여기에 순서대로 쌓입니다.</li>'
      }
    </ul>
  `;
}

export function createAlertInboxPanel({
  alertStore,
  onApply = null,
} = {}) {
  const panel = document.createElement("section");
  panel.className = "alert-inbox";

  let state = alertStore?.getState?.() ?? {
    selectedAlertId: null,
    items: [],
  };

  const render = () => {
    panel.innerHTML = getAlertInboxPanelMarkup({
      alerts: state.items,
      selectedAlertId: state.selectedAlertId,
    });
  };

  const unsubscribe = alertStore?.subscribe?.((nextState) => {
    state = nextState;
    render();
  });

  panel.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action][data-alert-id]");

    if (!trigger || !(trigger instanceof HTMLElement)) {
      return;
    }

    const { action, alertId } = trigger.dataset;
    const alert = state.items.find((item) => item.id === alertId);

    if (!alert) {
      return;
    }

    if (action === "apply") {
      alertStore.selectAlert(alertId);
      alertStore.acknowledge(alertId);
      onApply?.(alert);
      return;
    }

    if (action === "acknowledge") {
      alertStore.acknowledge(alertId);
    }
  });

  panel.destroy = () => {
    unsubscribe?.();
  };

  render();

  return panel;
}
