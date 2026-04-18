import { getMonitoringTimeframeLabel } from "../config/monitoringTimeframes.js";
import { TRADING_FORMULAS } from "../features/trading-formulas/trading-formulas.js";
import { formatSeoulDateTime } from "../lib/seoulTime.js";

export const CHART_CARD_TABS = Object.freeze([
  { id: "order", label: "주문" },
  { id: "orderbook", label: "호가" },
  { id: "chart", label: "차트" },
  { id: "market", label: "시세" },
  { id: "info", label: "정보" },
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSafeValue(value, formatter) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return formatter(value);
}

function formatSafePercent(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatSafeSignedValue(value, formatter) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatter(value)}`;
}

function formatDetectedAt(value) {
  return formatSeoulDateTime(value, {
    suffix: true,
    fallback: "실시간 대기",
  });
}

function resolveValueTone(value) {
  if (!Number.isFinite(value) || value === 0) {
    return "flat";
  }

  return value > 0 ? "up" : "down";
}

function resolveOrderbookStep(lastPrice) {
  if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
    return 0.1;
  }

  if (lastPrice >= 10_000) {
    return Math.max(0.5, Number((lastPrice * 0.00008).toFixed(2)));
  }

  if (lastPrice >= 100) {
    return Number((lastPrice * 0.0002).toFixed(3));
  }

  return Number((lastPrice * 0.001).toFixed(6));
}

function buildOrderbookRows(lastPrice) {
  if (!Number.isFinite(lastPrice)) {
    return [];
  }

  const step = resolveOrderbookStep(lastPrice);

  return Array.from({ length: 6 }, (_, index) => {
    const offset = 6 - index;
    const askPrice = lastPrice + step * offset;
    const bidPrice = lastPrice - step * offset;

    return {
      askPrice,
      askSize: (offset * 0.32 + 0.84).toFixed(3),
      bidPrice,
      bidSize: ((index + 1) * 0.29 + 0.76).toFixed(3),
    };
  });
}

export function getChartCardTabsMarkup(activeTab = "chart") {
  return CHART_CARD_TABS.map(
    (tab) => `
      <button
        type="button"
        class="chart-card__tab${tab.id === activeTab ? " is-active" : ""}"
        data-action="set-tab"
        data-tab="${escapeHtml(tab.id)}"
        aria-selected="${tab.id === activeTab}"
      >
        ${escapeHtml(tab.label)}
      </button>
    `,
  ).join("");
}

export function getOrderbookPanelMarkup({
  lastPrice = Number.NaN,
  formatter = (value) => String(value),
} = {}) {
  const rows = buildOrderbookRows(lastPrice);

  return `
    <section class="chart-card__detail-view chart-card__detail-view--orderbook">
      <div class="chart-card__panel-header">
        <div>
          <p>호가</p>
          <strong>가상 체결 참고 호가</strong>
        </div>
        <span>현재가 ${escapeHtml(formatSafeValue(lastPrice, formatter))}</span>
      </div>
      <div class="chart-card__surface-card chart-card__surface-card--orderbook">
        <div class="chart-card__orderbook-head">
          <span>매도</span>
          <span>수량</span>
          <span>매수</span>
          <span>수량</span>
        </div>
        <div class="chart-card__orderbook-list">
          ${
            rows.length > 0
              ? rows
                  .map(
                    (row) => `
                      <div class="chart-card__orderbook-row">
                        <strong class="is-ask">${escapeHtml(formatter(row.askPrice))}</strong>
                        <span>${escapeHtml(row.askSize)}</span>
                        <strong class="is-bid">${escapeHtml(formatter(row.bidPrice))}</strong>
                        <span>${escapeHtml(row.bidSize)}</span>
                      </div>
                    `,
                  )
                  .join("")
              : '<div class="chart-card__empty-state">호가 데이터 준비 중입니다.</div>'
          }
        </div>
      </div>
    </section>
  `;
}

export function getMarketSnapshotPanelMarkup({
  panel,
  metrics,
  performance = null,
  statusLabel,
  summaryLabel,
  latestAlert = null,
  formatter = (value) => String(value),
  volumeFormatter = (value) => String(value),
} = {}) {
  return `
    <section class="chart-card__detail-view chart-card__detail-view--market">
      <div class="chart-card__panel-header">
        <div>
          <p>시세</p>
          <strong>${escapeHtml(panel?.symbol ?? "--")} ${escapeHtml(
            getMonitoringTimeframeLabel(panel?.timeframe ?? "1m"),
          )}</strong>
        </div>
        <span>${escapeHtml(statusLabel ?? "상태 확인 중")}</span>
      </div>
      <div class="chart-card__market-grid">
        <article class="chart-card__surface-card">
          <p>현재가</p>
          <strong>${escapeHtml(formatSafeValue(metrics?.lastPrice, formatter))}</strong>
          <span>${escapeHtml(formatSafePercent(metrics?.priceChangePct))}</span>
        </article>
        <article class="chart-card__surface-card">
          <p>구간 고가</p>
          <strong>${escapeHtml(formatSafeValue(metrics?.sessionHigh, formatter))}</strong>
          <span>저가 ${escapeHtml(formatSafeValue(metrics?.sessionLow, formatter))}</span>
        </article>
        <article class="chart-card__surface-card">
          <p>최근 거래량</p>
          <strong>${escapeHtml(formatSafeValue(metrics?.lastVolume, volumeFormatter))}</strong>
          <span>구간 변화 ${escapeHtml(formatSafePercent(metrics?.windowChangePct))}</span>
        </article>
        <article class="chart-card__surface-card">
          <p>보유 수량</p>
          <strong>${escapeHtml(
            Number.isFinite(performance?.position?.quantity)
              ? performance.position.quantity.toFixed(6)
              : "--",
          )}</strong>
          <span>평단 ${escapeHtml(formatSafeValue(performance?.position?.avgEntryPrice, formatter))}</span>
        </article>
        <article class="chart-card__surface-card">
          <p>평가 손익</p>
          <strong class="is-${escapeHtml(resolveValueTone(performance?.position?.unrealizedPnl))}">${escapeHtml(
            formatSafeSignedValue(performance?.position?.unrealizedPnl, formatter),
          )}</strong>
          <span>${escapeHtml(formatSafePercent(performance?.position?.unrealizedPnlPct))}</span>
        </article>
        <article class="chart-card__surface-card">
          <p>실현 손익</p>
          <strong class="is-${escapeHtml(resolveValueTone(performance?.position?.realizedPnl))}">${escapeHtml(
            formatSafeSignedValue(performance?.position?.realizedPnl, formatter),
          )}</strong>
          <span>총손익 ${escapeHtml(formatSafePercent(performance?.position?.totalPnlPct))}</span>
        </article>
        <article class="chart-card__surface-card">
          <p>매매 성과</p>
          <strong>${escapeHtml(formatSafePercent(performance?.stats?.winRate))}</strong>
          <span>청산 ${escapeHtml(String(performance?.stats?.closedTradeCount ?? 0))}건</span>
        </article>
      </div>
      <article class="chart-card__surface-card chart-card__surface-card--summary">
        <p>실시간 상태</p>
        <strong>${escapeHtml(summaryLabel ?? "스트림 대기")}</strong>
        <span>${
          latestAlert
            ? `${escapeHtml(latestAlert.formulaName)} · ${escapeHtml(formatDetectedAt(latestAlert.detectedAt))}`
            : "최근 감지된 공식 없음"
        }</span>
      </article>
    </section>
  `;
}

export function getFormulaInfoPanelMarkup({
  timeframe = "1m",
} = {}) {
  const formulas = TRADING_FORMULAS.filter(
    (formula) => formula.detection?.timeframe === timeframe,
  );
  const visibleFormulas = formulas.length > 0 ? formulas : TRADING_FORMULAS;

  return `
    <section class="chart-card__detail-view chart-card__detail-view--info">
      <div class="chart-card__panel-header">
        <div>
          <p>정보</p>
          <strong>${escapeHtml(getMonitoringTimeframeLabel(timeframe))} 대응 공식</strong>
        </div>
        <span>${visibleFormulas.length}개 전략</span>
      </div>
      <div class="chart-card__formula-list">
        ${
          visibleFormulas
            .map(
              (formula) => `
                <article class="chart-card__surface-card chart-card__surface-card--formula">
                  <div class="chart-card__formula-head">
                    <strong>${escapeHtml(formula.name)}</strong>
                    <span>${escapeHtml(getMonitoringTimeframeLabel(formula.detection.timeframe))}</span>
                  </div>
                  <p>${escapeHtml(formula.description)}</p>
                </article>
              `,
            )
            .join("")
        }
      </div>
    </section>
  `;
}
