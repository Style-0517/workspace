import {
  TRADING_FORMULAS,
  getTradingFormulaById,
} from "../features/trading-formulas/trading-formulas.js";
import { getMonitoringTimeframeLabel } from "../config/monitoringTimeframes.js";

const SIGNAL_TYPE_LABELS = {
  "trend-continuation": "추세 지속",
  "momentum-breakout": "모멘텀 돌파",
  "reversal-confirmation": "반전 확인",
  "volatility-breakout": "변동성 돌파",
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSelectedFormula(selectedFormulaId) {
  return getTradingFormulaById(selectedFormulaId) ?? TRADING_FORMULAS[0] ?? null;
}

function getSignalTypeLabel(signalType) {
  return SIGNAL_TYPE_LABELS[signalType] ?? signalType;
}

function getTimeframeLabel(timeframe) {
  return getMonitoringTimeframeLabel(timeframe);
}

function renderFormulaListItem(formula, selectedFormulaId) {
  const isActive = formula.id === selectedFormulaId;

  return `
    <button
      class="formula-list__item${isActive ? " is-active" : ""}"
      type="button"
      aria-pressed="${isActive}"
      data-formula-id="${escapeHtml(formula.id)}"
    >
      <span class="formula-list__timeframe">${escapeHtml(getTimeframeLabel(formula.detection.timeframe))}</span>
      <strong>${escapeHtml(formula.name)}</strong>
      <span class="formula-list__meta">
        ${escapeHtml(getSignalTypeLabel(formula.detection.signalType))} · 조건 ${formula.detection.conditions.length}개
      </span>
    </button>
  `;
}

function renderFormulaDetail(formula) {
  if (!formula) {
    return `
      <article class="formula-detail" aria-live="polite">
        <p class="formula-detail__empty">표시할 트레이딩 공식이 없습니다.</p>
      </article>
    `;
  }

  const conditionsMarkup = formula.detection.conditions
    .map(
      (condition, index) => `
        <li class="formula-detail__condition">
          <div class="formula-detail__condition-header">
            <span class="formula-detail__condition-index">${index + 1}</span>
            <div>
              <strong>${escapeHtml(condition.name)}</strong>
              <p>${escapeHtml(condition.rationale)}</p>
            </div>
          </div>
          <code>${escapeHtml(condition.expression)}</code>
          <span class="formula-detail__indicators">
            지표 참조: ${escapeHtml(condition.indicatorRefs.join(", "))}
          </span>
        </li>
      `,
    )
    .join("");

  return `
    <article class="formula-detail" aria-live="polite">
      <div class="formula-detail__header">
        <div>
          <p class="formula-panel__eyebrow">선택 공식</p>
          <h3>${escapeHtml(formula.name)}</h3>
        </div>
        <span class="formula-detail__pill">${escapeHtml(getSignalTypeLabel(formula.detection.signalType))}</span>
      </div>
      <p class="formula-detail__description">${escapeHtml(formula.description)}</p>
      <dl class="formula-detail__facts">
        <div>
          <dt>감지 시간봉</dt>
          <dd>${escapeHtml(formula.detection.timeframe)}</dd>
        </div>
        <div>
          <dt>대상 심볼</dt>
          <dd>${escapeHtml(formula.detection.symbols.join(", "))}</dd>
        </div>
        <div>
          <dt>최대 알림 지연</dt>
          <dd>${escapeHtml(`${formula.detection.maxAlertLatencyMs / 1000}초`)}</dd>
        </div>
      </dl>
      <ol class="formula-detail__conditions">${conditionsMarkup}</ol>
    </article>
  `;
}

export function getTradingFormulaPanelMarkup({
  selectedFormulaId = TRADING_FORMULAS[0]?.id ?? "",
} = {}) {
  const selectedFormula = getSelectedFormula(selectedFormulaId);
  const selectedId = selectedFormula?.id ?? "";

  return `
    <div class="formula-panel__header">
      <div>
        <p class="formula-panel__eyebrow">공식</p>
        <h2 id="trading-formula-panel-title">사전 정의된 공식 3종</h2>
      </div>
      <p class="formula-panel__description">
        등록된 전략만 확인하고 신호가 나올 때 진입 판단에 사용합니다.
      </p>
    </div>
    <div class="formula-panel__notice" aria-label="공식 사용 제약">
      <span>추가/수정/삭제 비활성화</span>
      <span>기본 지원 종목 5개 연동</span>
      <span>공식 기준봉: 1분봉 · 5분봉</span>
      <span>차트 보기: 1분봉 · 5분봉</span>
    </div>
    <div class="formula-panel__catalog">
      <div class="formula-list" role="list" aria-label="등록된 트레이딩 공식 목록">
        ${TRADING_FORMULAS.map((formula) => renderFormulaListItem(formula, selectedId)).join("")}
      </div>
      ${renderFormulaDetail(selectedFormula)}
    </div>
  `;
}

export function createTradingFormulaPanel({
  initialFormulaId = TRADING_FORMULAS[0]?.id ?? "",
} = {}) {
  const panel = document.createElement("aside");
  panel.className = "formula-panel";
  panel.setAttribute("aria-labelledby", "trading-formula-panel-title");

  let selectedFormulaId = initialFormulaId;

  const render = () => {
    panel.innerHTML = getTradingFormulaPanelMarkup({
      selectedFormulaId,
    });
  };

  panel.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-formula-id]");

    if (!trigger || !(trigger instanceof HTMLElement)) {
      return;
    }

    const nextFormulaId = trigger.dataset.formulaId;

    if (
      !nextFormulaId ||
      nextFormulaId === selectedFormulaId ||
      !getTradingFormulaById(nextFormulaId)
    ) {
      return;
    }

    selectedFormulaId = nextFormulaId;
    render();
  });

  panel.setSelectedFormulaId = (nextFormulaId) => {
    if (!nextFormulaId || !getTradingFormulaById(nextFormulaId)) {
      return false;
    }

    if (nextFormulaId === selectedFormulaId) {
      return true;
    }

    selectedFormulaId = nextFormulaId;
    render();
    return true;
  };

  render();

  return panel;
}
