import {
  DEFAULT_VIRTUAL_CASH_CURRENCY,
} from "../config/localStateStorage.js";
import {
  MONITORING_TIMEFRAMES,
  getMonitoringTimeframeLabel,
} from "../config/monitoringTimeframes.js";
import { MARKET_SYMBOLS } from "../config/marketCatalog.js";
import {
  TRADING_FORMULAS,
  getTradingFormulaById,
} from "../features/trading-formulas/trading-formulas.js";

const ORDER_SYMBOLS = MARKET_SYMBOLS;
const QUICK_NOTIONAL_OPTIONS = Object.freeze(["50", "100", "250", "500"]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCash(value, currency = DEFAULT_VIRTUAL_CASH_CURRENCY) {
  return `${Number(value ?? 0).toFixed(2)} ${currency}`;
}

function formatReferencePrice(value) {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }

  return value >= 100 ? value.toFixed(3) : value.toFixed(6);
}

function renderSelectOptions(values, selectedValue, labelResolver = (value) => value) {
  return values
    .map(
      (value) => `
        <option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>
          ${escapeHtml(labelResolver(value))}
        </option>
      `,
    )
    .join("");
}

function renderFormulaOptions(selectedFormulaId) {
  return TRADING_FORMULAS.map(
    (formula) => `
      <option value="${escapeHtml(formula.id)}"${formula.id === selectedFormulaId ? " selected" : ""}>
        ${escapeHtml(formula.name)}
      </option>
    `,
  ).join("");
}

function renderOrderItem(order) {
  const formula = getTradingFormulaById(order.formulaId);

  return `
    <li class="mock-order-panel__history-item">
      <div>
        <strong>${escapeHtml(order.side.toUpperCase())} ${escapeHtml(order.symbol)}</strong>
        <p>${escapeHtml(formula?.name ?? order.formulaId)} · ${escapeHtml(
          getMonitoringTimeframeLabel(order.timeframe),
        )}</p>
      </div>
      <div class="mock-order-panel__history-meta">
        <span>${escapeHtml(formatCash(order.notional))}</span>
        <span>잔액 ${escapeHtml(formatCash(order.balanceAfterOrder))}</span>
      </div>
    </li>
  `;
}

function renderQuickAmountButton(value, selectedValue) {
  const isActive = value === String(selectedValue ?? "");

  return `
    <button
      type="button"
      class="mock-order-panel__quick-amount${isActive ? " is-active" : ""}"
      data-action="set-notional"
      data-notional="${escapeHtml(value)}"
    >
      ${escapeHtml(value)} USDT
    </button>
  `;
}

function renderSideToggleButton(side, activeSide) {
  const isActive = side === activeSide;
  const label = side === "buy" ? "매수" : "매도";

  return `
    <button
      type="button"
      class="mock-order-panel__side-toggle${isActive ? " is-active" : ""} is-${escapeHtml(side)}"
      data-action="set-side"
      data-side="${escapeHtml(side)}"
      aria-pressed="${isActive}"
    >
      ${label}
    </button>
  `;
}

export function getMockOrderPanelMarkup({
  ledgerState,
  draft,
  feedbackMessage = "",
} = {}) {
  const selectedFormula = getTradingFormulaById(draft.formulaId);
  const marketPriceLabel = formatReferencePrice(draft.marketPrice);

  return `
    <div class="mock-order-panel__header">
      <div>
        <p class="mock-order-panel__eyebrow">모의투자</p>
        <h2>가상 주문 입력</h2>
      </div>
      <div class="mock-order-panel__wallet">
        <strong>${escapeHtml(
          formatCash(ledgerState.availableCash, ledgerState.currency),
        )}</strong>
        <button type="button" data-action="reset-ledger">잔고 초기화</button>
      </div>
    </div>
    <p class="mock-order-panel__description">
      차트에서 확인한 시점 기준으로 수동 진입만 기록합니다.
    </p>
    <div class="mock-order-panel__market-meta">
      <span>현재 차트</span>
      <strong>${escapeHtml(draft.symbol)} · ${escapeHtml(
        getMonitoringTimeframeLabel(draft.timeframe),
      )}</strong>
      <span>기준가 ${escapeHtml(marketPriceLabel || "실시간 반영 중")}</span>
    </div>
    <div class="mock-order-panel__ticket">
      <div class="mock-order-panel__ticket-row">
        <div>
          <span class="mock-order-panel__ticket-label">심볼</span>
          <strong>${escapeHtml(draft.symbol)}</strong>
        </div>
        <div>
          <span class="mock-order-panel__ticket-label">시간봉</span>
          <strong>${escapeHtml(getMonitoringTimeframeLabel(draft.timeframe))}</strong>
        </div>
        <div>
          <span class="mock-order-panel__ticket-label">공식</span>
          <strong>${escapeHtml(selectedFormula?.name ?? draft.formulaId)}</strong>
        </div>
      </div>
      ${
        draft.sourceLabel
          ? `<div class="mock-order-panel__applied-alert">적용된 알림: ${escapeHtml(
              draft.sourceLabel,
            )}</div>`
          : ""
      }
    </div>
    ${
      feedbackMessage
        ? `<div class="mock-order-panel__feedback" aria-live="polite">${escapeHtml(
            feedbackMessage,
          )}</div>`
        : ""
    }
    <form class="mock-order-panel__form">
      <input type="hidden" name="sourceAlertId" value="${escapeHtml(
        draft.sourceAlertId ?? "",
      )}">
      <input type="hidden" name="symbol" value="${escapeHtml(draft.symbol)}">
      <input type="hidden" name="timeframe" value="${escapeHtml(draft.timeframe)}">
      <label class="mock-order-panel__field mock-order-panel__field--side">
        <span>방향</span>
        <div class="mock-order-panel__side-switch" role="group" aria-label="주문 방향">
          ${renderSideToggleButton("buy", draft.side)}
          ${renderSideToggleButton("sell", draft.side)}
        </div>
        <input type="hidden" name="side" value="${escapeHtml(draft.side)}">
      </label>
      <label class="mock-order-panel__field">
        <span>투입 금액 (USDT)</span>
        <input name="notional" type="number" min="1" step="1" value="${escapeHtml(
          draft.notional,
        )}">
      </label>
      <div class="mock-order-panel__quick-amounts">
        ${QUICK_NOTIONAL_OPTIONS.map((value) => renderQuickAmountButton(value, draft.notional)).join("")}
      </div>
      <label class="mock-order-panel__field">
        <span>참고 진입가</span>
        <input name="referencePrice" type="number" min="0" step="0.000001" value="${escapeHtml(
          draft.referencePrice,
        )}">
      </label>
      <label class="mock-order-panel__field mock-order-panel__field--span">
        <span>공식</span>
        <select name="formulaId">
          ${renderFormulaOptions(draft.formulaId)}
        </select>
      </label>
      <label class="mock-order-panel__field mock-order-panel__field--span">
        <span>메모</span>
        <textarea name="note" rows="3" placeholder="왜 진입하는지 간단히 남겨두면 복기에 도움이 됩니다.">${escapeHtml(
          draft.note,
        )}</textarea>
      </label>
      <button class="mock-order-panel__submit" type="submit">
        ${draft.side === "sell" ? "가상 매도 기록" : "가상 매수 기록"}
      </button>
    </form>
    <div class="mock-order-panel__history">
      <div class="mock-order-panel__history-header">
        <h3>최근 주문</h3>
        <span>${ledgerState.orders.length}건</span>
      </div>
      <ul>
        ${
          ledgerState.orders.length > 0
            ? ledgerState.orders.slice(0, 6).map(renderOrderItem).join("")
            : '<li class="mock-order-panel__history-empty">아직 기록된 가상 주문이 없습니다.</li>'
        }
      </ul>
    </div>
  `;
}

export function createMockOrderPanel({
  orderLedger,
} = {}) {
  const panel = document.createElement("section");
  panel.className = "mock-order-panel";

  let ledgerState = orderLedger?.getState?.() ?? {
    availableCash: 0,
    currency: DEFAULT_VIRTUAL_CASH_CURRENCY,
    orders: [],
  };
  let feedbackMessage = "";
  let draft = {
    symbol: ORDER_SYMBOLS[0],
    timeframe: MONITORING_TIMEFRAMES[0],
    formulaId: TRADING_FORMULAS[0]?.id ?? "",
    side: "buy",
    notional: "100",
    referencePrice: "",
    note: "",
    sourceAlertId: "",
    sourceLabel: "",
    marketPrice: null,
  };

  const render = () => {
    panel.innerHTML = getMockOrderPanelMarkup({
      ledgerState,
      draft,
      feedbackMessage,
    });
  };

  const unsubscribe = orderLedger?.subscribe?.((nextState) => {
    ledgerState = nextState;
    render();
  });

  panel.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");

    if (!trigger || !(trigger instanceof HTMLElement)) {
      return;
    }

    if (trigger.dataset.action === "reset-ledger") {
      orderLedger.reset();
      feedbackMessage = "가상 잔고와 주문 이력을 초기 상태로 되돌렸습니다.";
      draft = {
        ...draft,
        notional: "100",
        note: "",
        sourceAlertId: "",
        sourceLabel: "",
        marketPrice: draft.marketPrice,
      };
      render();
      return;
    }

    if (trigger.dataset.action === "set-side" && trigger.dataset.side) {
      draft = {
        ...draft,
        side: trigger.dataset.side === "sell" ? "sell" : "buy",
      };
      render();
      return;
    }

    if (trigger.dataset.action === "set-notional" && trigger.dataset.notional) {
      draft = {
        ...draft,
        notional: trigger.dataset.notional,
      };
      render();
    }
  });

  panel.addEventListener("submit", (event) => {
    if (!(event.target instanceof HTMLFormElement)) {
      return;
    }

    event.preventDefault();
    const formData = new FormData(event.target);
    const result = orderLedger.placeOrder({
      symbol: draft.symbol,
      timeframe: draft.timeframe,
      formulaId: formData.get("formulaId"),
      side: formData.get("side"),
      notional: formData.get("notional"),
      referencePrice: formData.get("referencePrice"),
      note: formData.get("note"),
      sourceAlertId: formData.get("sourceAlertId"),
    });

    if (!result.ok) {
      feedbackMessage = result.error;
      render();
      return;
    }

    draft = {
      ...draft,
      formulaId: String(formData.get("formulaId")),
      side: String(formData.get("side")),
      notional: "100",
      referencePrice: String(formData.get("referencePrice") ?? ""),
      note: "",
      sourceAlertId: String(formData.get("sourceAlertId") ?? ""),
      sourceLabel: draft.sourceLabel,
    };
    feedbackMessage = `${result.order.symbol} ${result.order.timeframe} ${result.order.side.toUpperCase()} 주문이 저장되었습니다.`;
    render();
  });

  panel.applyAlert = (alert) => {
    draft = {
      symbol: alert.symbol,
      timeframe: alert.timeframe,
      formulaId: alert.formulaId,
      side: "buy",
      notional: "100",
      referencePrice: formatReferencePrice(alert.entryPrice),
      note: "",
      sourceAlertId: alert.id,
      sourceLabel: `${alert.formulaName} · ${alert.symbol} ${getMonitoringTimeframeLabel(alert.timeframe)}`,
      marketPrice: alert.entryPrice ?? draft.marketPrice,
    };
    feedbackMessage = "선택한 신호를 주문 입력값에 적용했습니다.";
    render();
  };

  panel.setContext = ({ symbol = null, timeframe = null } = {}) => {
    let hasChanged = false;

    if (symbol && ORDER_SYMBOLS.includes(symbol) && symbol !== draft.symbol) {
      draft = {
        ...draft,
        symbol,
      };
      hasChanged = true;
    }

    if (
      timeframe &&
      MONITORING_TIMEFRAMES.includes(timeframe) &&
      timeframe !== draft.timeframe
    ) {
      draft = {
        ...draft,
        timeframe,
      };
      hasChanged = true;
    }

    if (hasChanged) {
      render();
    }

    return hasChanged;
  };

  panel.setMarketSnapshot = ({ lastPrice = null } = {}) => {
    if (!Number.isFinite(lastPrice)) {
      return false;
    }

    const nextReferencePrice = formatReferencePrice(lastPrice);
    const shouldBackfillReferencePrice =
      (draft.referencePrice == null || draft.referencePrice === "") &&
      !draft.sourceAlertId;

    draft = {
      ...draft,
      marketPrice: lastPrice,
      referencePrice: shouldBackfillReferencePrice
        ? nextReferencePrice
        : draft.referencePrice,
    };
    render();
    return true;
  };

  panel.destroy = () => {
    unsubscribe?.();
  };

  render();

  return panel;
}
