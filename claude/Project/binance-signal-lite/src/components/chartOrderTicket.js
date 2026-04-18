import { DEFAULT_VIRTUAL_CASH_CURRENCY } from "../config/localStateStorage.js";
import { getMonitoringTimeframeLabel } from "../config/monitoringTimeframes.js";
import { summarizeOrderPerformance } from "../features/orders/orderAnalytics.js";
import {
  TRADING_FORMULAS,
  getTradingFormulaById,
} from "../features/trading-formulas/trading-formulas.js";
import { formatSeoulTime } from "../lib/seoulTime.js";

const QUICK_NOTIONAL_OPTIONS = Object.freeze(["50", "100", "250", "500"]);
const MAKER_FEE_RATE = 0.0005;
const ORDER_TYPE_LABELS = Object.freeze({
  limit: "지정가",
  market: "시장가",
  auto: "자동",
});
const ORDER_STATUS_LABELS = Object.freeze({
  filled: "체결",
  pending: "대기",
  rejected: "거절",
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeOrderType(value) {
  if (value === "limit" || value === "auto") {
    return value;
  }

  return "market";
}

function formatCash(value, currency = DEFAULT_VIRTUAL_CASH_CURRENCY) {
  return `${Number(value ?? 0).toFixed(2)} ${currency}`;
}

function formatNotional(value) {
  if (!Number.isFinite(value)) {
    return "0.00";
  }

  return value >= 1_000 ? value.toFixed(0) : value.toFixed(2);
}

function formatPrice(value) {
  if (value == null || !Number.isFinite(value)) {
    return "";
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

function formatCompactCoin(value) {
  if (!Number.isFinite(value)) {
    return "0.0000";
  }

  if (value >= 100) {
    return value.toFixed(2);
  }

  if (value >= 1) {
    return value.toFixed(4);
  }

  return value.toFixed(6);
}

function formatOrderTime(value) {
  return formatSeoulTime(value, {
    includeSeconds: true,
    fallback: "--:--",
  });
}

function getFirstFormulaIdForTimeframe(timeframe) {
  return (
    TRADING_FORMULAS.find((formula) => formula.detection?.timeframe === timeframe)?.id
    ?? TRADING_FORMULAS[0]?.id
    ?? ""
  );
}

function renderFormulaOptions(selectedFormulaId, timeframe) {
  const formulas = TRADING_FORMULAS.filter(
    (formula) => formula.detection?.timeframe === timeframe,
  );
  const visibleFormulas = formulas.length > 0 ? formulas : TRADING_FORMULAS;

  return visibleFormulas.map(
    (formula) => `
      <option value="${escapeHtml(formula.id)}"${formula.id === selectedFormulaId ? " selected" : ""}>
        ${escapeHtml(formula.name)}
      </option>
    `,
  ).join("");
}

function renderSideButton(side, activeSide) {
  const isActive = side === activeSide;
  const label = side === "buy" ? "BTC 매수" : "BTC 매도";

  return `
    <button
      type="button"
      class="chart-order-ticket__trade-tab${isActive ? " is-active" : ""} is-${escapeHtml(side)}"
      data-action="set-side"
      data-side="${escapeHtml(side)}"
      aria-pressed="${isActive}"
    >
      ${label}
    </button>
  `;
}

function renderOrderTypeButton(orderType, activeOrderType) {
  const isActive = orderType === activeOrderType;

  return `
    <button
      type="button"
      class="chart-order-ticket__type-tab${isActive ? " is-active" : ""}"
      data-action="set-order-type"
      data-order-type="${escapeHtml(orderType)}"
      aria-pressed="${isActive}"
    >
      ${escapeHtml(ORDER_TYPE_LABELS[orderType] ?? "시장가")}
    </button>
  `;
}

function renderQuickAmount(value, selectedValue) {
  const isActive = value === String(selectedValue ?? "");

  return `
    <button
      type="button"
      class="chart-order-ticket__quick-amount${isActive ? " is-active" : ""}"
      data-action="set-notional"
      data-notional="${escapeHtml(value)}"
    >
      ${escapeHtml(value)}
    </button>
  `;
}

function buildDepthRows(lastPrice) {
  if (!Number.isFinite(lastPrice)) {
    return [];
  }

  const tick = lastPrice >= 10_000
    ? Math.max(0.5, Number((lastPrice * 0.00008).toFixed(2)))
    : lastPrice >= 100
      ? Number((lastPrice * 0.0002).toFixed(3))
      : Number((lastPrice * 0.001).toFixed(6));

  return Array.from({ length: 7 }, (_, index) => {
    const offset = 7 - index;

    return {
      askPrice: lastPrice + tick * offset,
      askSize: Number((1.02 + offset * 0.17).toFixed(4)),
      bidPrice: lastPrice - tick * offset,
      bidSize: Number((0.96 + (index + 1) * 0.19).toFixed(4)),
    };
  });
}

function renderDepthRow(row, formatter, tone) {
  const price = tone === "ask" ? row.askPrice : row.bidPrice;
  const size = tone === "ask" ? row.askSize : row.bidSize;

  return `
    <div class="chart-order-ticket__depth-row is-${tone}">
      <strong>${escapeHtml(formatter(price))}</strong>
      <span>${escapeHtml(formatCompactCoin(size))}</span>
    </div>
  `;
}

function resolveDisplayedPrice(order) {
  return order.executionPrice ?? order.referencePrice ?? order.marketPriceAtPlacement;
}

function renderHistoryItem(order) {
  const formula = getTradingFormulaById(order.formulaId);
  const typeLabel = ORDER_TYPE_LABELS[order.orderType] ?? ORDER_TYPE_LABELS.market;
  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? ORDER_STATUS_LABELS.filled;

  return `
    <li class="chart-order-ticket__history-item is-${escapeHtml(order.status)}">
      <span>${escapeHtml(formatOrderTime(order.filledAt ?? order.placedAt))}</span>
      <strong class="is-${escapeHtml(order.side === "sell" ? "sell" : "buy")}">${escapeHtml(
        formatPrice(resolveDisplayedPrice(order)) || "--",
      )}</strong>
      <span>${escapeHtml(formatNotional(order.notional))}</span>
      <span class="chart-order-ticket__history-meta">
        <span>${escapeHtml(formula?.name ?? order.formulaId)}</span>
        <small class="is-${escapeHtml(order.status)}">${escapeHtml(
          `${typeLabel} · ${statusLabel}`,
        )}</small>
      </span>
    </li>
  `;
}

function getPriceFieldConfig(draft, lastPrice) {
  const referencePrice = Number(draft.referencePrice);

  if (draft.orderType === "market") {
    return {
      label: "시장 체결가",
      hint: "현재 실시간 가격으로 바로 체결됩니다.",
      value: formatPrice(lastPrice) || "",
      placeholder: "실시간 가격 대기 중",
      readOnly: true,
    };
  }

  if (draft.orderType === "auto") {
    const visiblePrice =
      Number.isFinite(referencePrice) && referencePrice > 0
        ? formatPrice(referencePrice)
        : formatPrice(lastPrice) || "";

    return {
      label: "자동 기준가",
      hint: draft.sourceAlertId
        ? "적용된 신호 진입가를 우선 사용해 자동 진입합니다."
        : "먼저 알림에서 신호를 적용하면 자동 주문을 사용할 수 있습니다.",
      value: visiblePrice,
      placeholder: "신호 기준가",
      readOnly: true,
    };
  }

  return {
    label: "주문 가격",
    hint: "현재가보다 유리한 가격이면 바로 체결되고, 아니면 대기 주문으로 남습니다.",
    value: draft.referencePrice,
    placeholder: formatPrice(lastPrice) || "가격 입력",
    readOnly: false,
  };
}

function getOrderSuccessMessage(order) {
  const typeLabel = ORDER_TYPE_LABELS[order.orderType] ?? ORDER_TYPE_LABELS.market;

  if (order.status === "pending") {
    return `${typeLabel} 주문이 대기열에 등록되었습니다.`;
  }

  if (order.orderType === "auto") {
    return `${typeLabel} 주문이 신호 기준으로 체결되었습니다.`;
  }

  return `${typeLabel} ${order.side === "sell" ? "매도" : "매수"} 주문이 체결되었습니다.`;
}

function renderPositionSnapshot(ledgerState, draft, lastPrice) {
  const performance = summarizeOrderPerformance({
    orders: ledgerState.orders,
    symbol: draft.symbol,
    marketPrice: lastPrice,
  });
  const position = performance.position;

  return `
    <div class="chart-order-ticket__position-strip">
      <div>
        <span>보유</span>
        <strong>${escapeHtml(
          position.quantity > 0 ? `${position.quantity.toFixed(6)} BTC` : "--",
        )}</strong>
      </div>
      <div>
        <span>평단</span>
        <strong>${escapeHtml(formatPrice(position.avgEntryPrice) || "--")}</strong>
      </div>
      <div>
        <span>평가</span>
        <strong class="is-${
          position.unrealizedPnl > 0 ? "buy" : position.unrealizedPnl < 0 ? "sell" : "flat"
        }">${escapeHtml(
          position.unrealizedPnl == null
            ? "--"
            : formatCash(position.unrealizedPnl, ledgerState.currency),
        )}</strong>
      </div>
      <div>
        <span>승률</span>
        <strong>${escapeHtml(
          Number.isFinite(performance.stats.winRate)
            ? `${performance.stats.winRate.toFixed(2)}%`
            : "--",
        )}</strong>
      </div>
    </div>
  `;
}

export function getChartOrderTicketMarkup({
  ledgerState,
  draft,
  feedbackMessage = "",
} = {}) {
  const selectedFormula = getTradingFormulaById(draft.formulaId);
  const lastPrice = Number.isFinite(draft.marketPrice) ? draft.marketPrice : Number.NaN;
  const referencePrice = Number(draft.referencePrice);
  const resolvedReferencePrice = Number.isFinite(referencePrice) && referencePrice > 0
    ? referencePrice
    : lastPrice;
  const estimatedCoin = Number(draft.notional) > 0
    && Number.isFinite(resolvedReferencePrice)
    && resolvedReferencePrice > 0
    ? Number(draft.notional) / resolvedReferencePrice
    : 0;
  const estimatedFee = Number(draft.notional) > 0
    ? Number(draft.notional) * MAKER_FEE_RATE
    : 0;
  const depthRows = buildDepthRows(lastPrice);
  const priceField = getPriceFieldConfig(draft, lastPrice);

  return `
    <section class="chart-order-ticket">
      <div class="chart-order-ticket__head">
        <div>
          <p>거래</p>
          <strong>${escapeHtml(draft.symbol)} · ${escapeHtml(
            getMonitoringTimeframeLabel(draft.timeframe),
          )}</strong>
        </div>
        <div class="chart-order-ticket__head-price">
          <strong>${escapeHtml(formatPrice(lastPrice) || "--")}</strong>
          <span>가상 잔고 ${escapeHtml(
            formatCash(ledgerState.availableCash, ledgerState.currency),
          )}</span>
        </div>
      </div>

      ${
        draft.sourceLabel
          ? `<div class="chart-order-ticket__signal">적용된 신호: ${escapeHtml(draft.sourceLabel)}</div>`
          : ""
      }

      ${
        feedbackMessage
          ? `<div class="chart-order-ticket__feedback" aria-live="polite">${escapeHtml(feedbackMessage)}</div>`
          : ""
      }

      ${renderPositionSnapshot(ledgerState, draft, lastPrice)}

      <div class="chart-order-ticket__desk">
        <section class="chart-order-ticket__depth-panel">
          <div class="chart-order-ticket__panel-title">
            <strong>호가</strong>
            <span>가격 / 수량</span>
          </div>
          <div class="chart-order-ticket__depth-head">
            <span>가격</span>
            <span>수량</span>
          </div>
          <div class="chart-order-ticket__depth-list is-asks">
            ${depthRows.map((row) => renderDepthRow(row, formatPrice, "ask")).join("")}
          </div>
          <div class="chart-order-ticket__depth-price">
            <strong>${escapeHtml(formatPrice(lastPrice) || "--")}</strong>
            <span>${draft.side === "sell" ? "매도 기준" : "매수 기준"}</span>
          </div>
          <div class="chart-order-ticket__depth-list is-bids">
            ${depthRows.slice().reverse().map((row) => renderDepthRow(row, formatPrice, "bid")).join("")}
          </div>
        </section>

        <form class="chart-order-ticket__entry-panel">
          <input type="hidden" name="sourceAlertId" value="${escapeHtml(draft.sourceAlertId ?? "")}">
          <input type="hidden" name="side" value="${escapeHtml(draft.side)}">
          <input type="hidden" name="orderType" value="${escapeHtml(draft.orderType)}">

          <div class="chart-order-ticket__trade-tabs">
            ${renderSideButton("buy", draft.side)}
            ${renderSideButton("sell", draft.side)}
          </div>

          <div class="chart-order-ticket__type-tabs" aria-label="주문 방식">
            ${renderOrderTypeButton("limit", draft.orderType)}
            ${renderOrderTypeButton("market", draft.orderType)}
            ${renderOrderTypeButton("auto", draft.orderType)}
          </div>

          <label class="chart-order-ticket__field">
            <span>${escapeHtml(priceField.label)}</span>
            <input
              name="referencePrice"
              type="number"
              min="0"
              step="0.000001"
              value="${escapeHtml(priceField.value)}"
              placeholder="${escapeHtml(priceField.placeholder)}"
              ${priceField.readOnly ? 'readonly aria-readonly="true" data-readonly="true"' : ""}
            >
            <small class="chart-order-ticket__field-hint">${escapeHtml(priceField.hint)}</small>
          </label>

          <label class="chart-order-ticket__field">
            <span>주문 금액</span>
            <input
              name="notional"
              type="number"
              min="1"
              step="1"
              value="${escapeHtml(draft.notional)}"
              placeholder="금액 입력"
            >
          </label>

          <div class="chart-order-ticket__quick-row">
            ${QUICK_NOTIONAL_OPTIONS.map((value) => renderQuickAmount(value, draft.notional)).join("")}
          </div>

          <div class="chart-order-ticket__summary">
            <div>
              <span>예상 수량</span>
              <strong>${escapeHtml(formatCompactCoin(estimatedCoin))} BTC</strong>
            </div>
            <div>
              <span>예상 수수료</span>
              <strong>${escapeHtml(formatCash(estimatedFee))}</strong>
            </div>
          </div>

          <label class="chart-order-ticket__field">
            <span>적용 공식</span>
            <select name="formulaId">
              ${renderFormulaOptions(draft.formulaId, draft.timeframe)}
            </select>
          </label>

          <label class="chart-order-ticket__field">
            <span>메모</span>
            <textarea
              name="note"
              rows="2"
              placeholder="진입 이유를 짧게 남겨두면 복기에 도움이 됩니다."
            >${escapeHtml(draft.note)}</textarea>
          </label>

          <div class="chart-order-ticket__meta">
            <span>${escapeHtml(selectedFormula?.name ?? "공식 선택")}</span>
            <span>${escapeHtml(getMonitoringTimeframeLabel(draft.timeframe))}</span>
          </div>

          <div class="chart-order-ticket__actions">
            <button type="button" class="chart-order-ticket__ghost" data-action="reset-ledger">초기화</button>
            <button
              type="submit"
              class="chart-order-ticket__submit is-${escapeHtml(draft.side)}"
            >
              ${draft.side === "sell" ? "BTC 매도" : "BTC 매수"}
            </button>
          </div>
        </form>
      </div>

      <div class="chart-order-ticket__history">
        <div class="chart-order-ticket__history-header">
          <strong>주문 / 체결 내역</strong>
          <span>${ledgerState.orders.length}건</span>
        </div>
        <div class="chart-order-ticket__history-head">
          <span>시간</span>
          <span>가격</span>
          <span>금액</span>
          <span>공식</span>
        </div>
        <ul>
          ${
            ledgerState.orders.length > 0
              ? ledgerState.orders.slice(0, 6).map(renderHistoryItem).join("")
              : '<li class="chart-order-ticket__history-empty">아직 기록된 주문이 없습니다.</li>'
          }
        </ul>
      </div>
    </section>
  `;
}

export function createChartOrderTicket({
  orderLedger,
} = {}) {
  const panel = document.createElement("section");
  panel.className = "chart-order-ticket-shell";

  let ledgerState = orderLedger?.getState?.() ?? {
    availableCash: 0,
    currency: DEFAULT_VIRTUAL_CASH_CURRENCY,
    orders: [],
  };
  let feedbackMessage = "";
  let isEditingForm = false;
  let hasDeferredRender = false;
  let hasTouchedReferencePrice = false;
  let draft = {
    symbol: "BTCUSDT",
    timeframe: "1m",
    formulaId: getFirstFormulaIdForTimeframe("1m"),
    side: "buy",
    orderType: "limit",
    notional: "100",
    referencePrice: "",
    note: "",
    sourceAlertId: "",
    sourceLabel: "",
    marketPrice: null,
  };

  const render = () => {
    panel.innerHTML = getChartOrderTicketMarkup({
      ledgerState,
      draft,
      feedbackMessage,
    });
    hasDeferredRender = false;
  };

  const flushDeferredRender = () => {
    if (!hasDeferredRender || isEditingForm) {
      return false;
    }

    render();
    return true;
  };

  const renderSafely = () => {
    if (isEditingForm) {
      hasDeferredRender = true;
      return false;
    }

    render();
    return true;
  };

  const syncDraftFromForm = (form) => {
    const formData = new FormData(form);

    draft = {
      ...draft,
      formulaId: String(formData.get("formulaId") ?? draft.formulaId),
      side: formData.get("side") === "sell" ? "sell" : "buy",
      orderType: normalizeOrderType(formData.get("orderType")),
      notional: String(formData.get("notional") ?? draft.notional),
      referencePrice: String(formData.get("referencePrice") ?? draft.referencePrice),
      note: String(formData.get("note") ?? draft.note),
      sourceAlertId: String(formData.get("sourceAlertId") ?? draft.sourceAlertId),
    };
  };

  const unsubscribe = orderLedger?.subscribe?.((nextState) => {
    ledgerState = nextState;
    renderSafely();
  });

  panel.addEventListener("focusin", (event) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.matches("input, textarea, select")
    ) {
      isEditingForm = true;
    }
  });

  panel.addEventListener("focusout", () => {
    queueMicrotask(() => {
      const activeElement = panel.ownerDocument?.activeElement;
      const nextEditingState = Boolean(
        activeElement instanceof HTMLElement &&
        panel.contains(activeElement) &&
        activeElement.matches("input, textarea, select"),
      );

      isEditingForm = nextEditingState;
      flushDeferredRender();
    });
  });

  panel.addEventListener("input", (event) => {
    const form = event.target instanceof HTMLElement
      ? event.target.closest("form")
      : null;

    if (
      event.target instanceof HTMLInputElement &&
      event.target.name === "referencePrice"
    ) {
      hasTouchedReferencePrice = true;
    }

    if (form instanceof HTMLFormElement) {
      syncDraftFromForm(form);
    }
  });

  panel.addEventListener("change", (event) => {
    const form = event.target instanceof HTMLElement
      ? event.target.closest("form")
      : null;

    if (form instanceof HTMLFormElement) {
      syncDraftFromForm(form);
    }
  });

  panel.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");

    if (!trigger || !(trigger instanceof HTMLElement)) {
      return;
    }

    const form = trigger.closest("form");

    if (form instanceof HTMLFormElement) {
      syncDraftFromForm(form);
    }

    if (trigger.dataset.action === "set-side" && trigger.dataset.side) {
      draft = {
        ...draft,
        side: trigger.dataset.side === "sell" ? "sell" : "buy",
      };
      renderSafely();
      return;
    }

    if (
      trigger.dataset.action === "set-order-type"
      && trigger.dataset.orderType
    ) {
      draft = {
        ...draft,
        orderType: normalizeOrderType(trigger.dataset.orderType),
      };
      renderSafely();
      return;
    }

    if (trigger.dataset.action === "set-notional" && trigger.dataset.notional) {
      draft = {
        ...draft,
        notional: trigger.dataset.notional,
      };
      renderSafely();
      return;
    }

    if (trigger.dataset.action === "reset-ledger") {
      orderLedger.reset();
      feedbackMessage = "가상 잔고와 주문 이력을 초기 상태로 되돌렸습니다.";
      hasTouchedReferencePrice = false;
      renderSafely();
    }
  });

  panel.addEventListener("submit", (event) => {
    if (!(event.target instanceof HTMLFormElement)) {
      return;
    }

    event.preventDefault();
    syncDraftFromForm(event.target);

    if (draft.orderType === "market" && !Number.isFinite(draft.marketPrice)) {
      feedbackMessage = "실시간 가격이 준비되면 시장가 주문을 넣을 수 있습니다.";
      renderSafely();
      return;
    }

    const formData = new FormData(event.target);
    const submittedReferencePrice = draft.orderType === "limit"
      ? formData.get("referencePrice")
      : draft.orderType === "auto"
        ? draft.referencePrice || draft.marketPrice
        : draft.marketPrice ?? formData.get("referencePrice");
    const result = orderLedger.placeOrder({
      symbol: draft.symbol,
      timeframe: draft.timeframe,
      formulaId: formData.get("formulaId"),
      side: formData.get("side"),
      orderType: draft.orderType,
      notional: formData.get("notional"),
      referencePrice: submittedReferencePrice,
      marketPrice: draft.marketPrice,
      note: formData.get("note"),
      sourceAlertId: formData.get("sourceAlertId"),
    });

    if (!result.ok) {
      feedbackMessage = result.error;
      renderSafely();
      return;
    }

    draft = {
      ...draft,
      formulaId: String(formData.get("formulaId") ?? draft.formulaId),
      side: String(formData.get("side") ?? draft.side),
      notional: "100",
      referencePrice:
        draft.orderType === "limit"
          ? String(formData.get("referencePrice") ?? draft.referencePrice)
          : formatPrice(result.order.executionPrice ?? draft.marketPrice),
      note: "",
      sourceAlertId: String(formData.get("sourceAlertId") ?? draft.sourceAlertId),
    };
    feedbackMessage = getOrderSuccessMessage(result.order);
    hasTouchedReferencePrice = draft.orderType === "limit";
    renderSafely();
  });

  panel.applyAlert = (alert) => {
    draft = {
      ...draft,
      symbol: alert.symbol,
      timeframe: alert.timeframe,
      formulaId: alert.formulaId,
      side: "buy",
      notional: "100",
      referencePrice: formatPrice(alert.entryPrice),
      note: "",
      sourceAlertId: alert.id,
      sourceLabel: `${alert.formulaName} · ${alert.symbol} ${getMonitoringTimeframeLabel(alert.timeframe)}`,
      marketPrice: alert.entryPrice ?? draft.marketPrice,
    };
    feedbackMessage = "선택한 신호를 주문 입력값에 적용했습니다.";
    hasTouchedReferencePrice = true;
    renderSafely();
  };

  panel.setContext = ({ symbol = null, timeframe = null } = {}) => {
    let hasChanged = false;
    let nextFormulaId = draft.formulaId;

    if (timeframe && timeframe !== draft.timeframe) {
      nextFormulaId = getFirstFormulaIdForTimeframe(timeframe);
    }

    if (symbol && symbol !== draft.symbol) {
      draft = {
        ...draft,
        symbol,
      };
      hasChanged = true;
    }

    if (timeframe && timeframe !== draft.timeframe) {
      draft = {
        ...draft,
        timeframe,
        formulaId: nextFormulaId,
      };
      hasChanged = true;
    }

    if (hasChanged) {
      renderSafely();
    }

    return hasChanged;
  };

  panel.setMarketSnapshot = ({ lastPrice = null } = {}) => {
    if (!Number.isFinite(lastPrice)) {
      return false;
    }

    const previousMarketPrice = draft.marketPrice;

    const tickResult = orderLedger.processMarketTick?.({
      symbol: draft.symbol,
      lastPrice,
    });
    const shouldBackfillReferencePrice =
      !hasTouchedReferencePrice &&
      (draft.referencePrice == null || draft.referencePrice === "")
      && !draft.sourceAlertId;
    const hasLedgerSideEffect =
      Boolean(tickResult?.rejectedOrders?.length) || Boolean(tickResult?.filledOrders?.length);
    const hasMarketPriceChanged = !Object.is(previousMarketPrice, lastPrice);

    if (!hasMarketPriceChanged && !shouldBackfillReferencePrice && !hasLedgerSideEffect) {
      return false;
    }

    draft = {
      ...draft,
      marketPrice: lastPrice,
      referencePrice: shouldBackfillReferencePrice
        ? formatPrice(lastPrice)
        : draft.referencePrice,
    };

    if (tickResult?.rejectedOrders?.length > 0) {
      feedbackMessage = `대기 중이던 지정가 주문 ${tickResult.rejectedOrders.length}건이 잔고 부족으로 거절되었습니다.`;
    } else if (tickResult?.filledOrders?.length > 0) {
      feedbackMessage = `대기 중이던 지정가 주문 ${tickResult.filledOrders.length}건이 체결되었습니다.`;
    }

    renderSafely();
    return true;
  };

  panel.destroy = () => {
    unsubscribe?.();
  };

  render();

  return panel;
}
