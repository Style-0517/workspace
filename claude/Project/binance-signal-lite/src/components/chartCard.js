import { generateMockCandles } from "../lib/mockCandles.js";
import { createLightweightChartRenderer } from "../lib/lightweightChartRenderer.js";
import {
  getChartCardTabsMarkup,
  getFormulaInfoPanelMarkup,
  getMarketSnapshotPanelMarkup,
  getOrderbookPanelMarkup,
} from "./chartCardPanels.js";
import {
  buildTradeMarkers,
  summarizeOrderPerformance,
} from "../features/orders/orderAnalytics.js";
import {
  getMonitoringTimeframeLabel,
  getMonitoringTimeframeOptions,
} from "../config/monitoringTimeframes.js";
import { APP_BRAND_BADGE } from "../config/branding.js";
import { getMarketDisplay } from "../config/marketCatalog.js";
import { formatSeoulDateTime } from "../lib/seoulTime.js";

const STATUS_LABELS = Object.freeze({
  idle: "연결 준비 중",
  loading: "시드 캔들 로딩 중",
  ready: "초기 캔들 준비 완료",
  streaming: "실시간 캔들 수신 중",
  error: "연결 오류 감지",
  stopped: "스트림 중지",
});

function clampToNumber(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatSignedPrice(value, formatter) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatter(value)}`;
}

function getMarketLabel(symbol) {
  return getMarketDisplay(symbol);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAlertDetectedAt(value) {
  return formatSeoulDateTime(value, {
    suffix: true,
    fallback: "방금",
  });
}

function formatTradeTimestamp(value) {
  return formatSeoulDateTime(value, {
    padDate: true,
    suffix: true,
    fallback: "--",
  });
}

function resolveOverlayLabel(snapshot) {
  if (!snapshot) {
    return "";
  }

  if (snapshot.status === "error") {
    return "Binance 데이터 수신 실패";
  }

  if (snapshot.status === "stopped") {
    return "실시간 스트림 중지";
  }

  if (snapshot.status === "loading") {
    return "Binance 시드 캔들 로딩 중";
  }

  if (snapshot.status === "idle") {
    return "Binance 연결 준비 중";
  }

  if ((snapshot.candles ?? []).length === 0) {
    return "실시간 캔들 대기 중";
  }

  return "";
}

function resolveStatusLabel(snapshot) {
  if (!snapshot) {
    return "데모 프리뷰";
  }

  return STATUS_LABELS[snapshot.status] ?? "상태 확인 중";
}

function resolvePillTone(snapshot) {
  if (!snapshot) {
    return "waiting";
  }

  if (snapshot.status === "streaming") {
    return "live";
  }

  if (snapshot.status === "error") {
    return "error";
  }

  return "waiting";
}

function resolvePillLabel(snapshot) {
  if (!snapshot) {
    return "DEMO";
  }

  if (snapshot.status === "streaming") {
    return "LIVE";
  }

  if (snapshot.status === "ready") {
    return "READY";
  }

  if (snapshot.status === "error") {
    return "ERROR";
  }

  if (snapshot.status === "loading") {
    return "SYNC";
  }

  return "WAIT";
}

function calculateMetrics(snapshot = null) {
  const candles = snapshot?.candles ?? [];
  const resolvedCandles = candles.map((candle) => ({
    open: clampToNumber(candle.open),
    high: clampToNumber(candle.high),
    low: clampToNumber(candle.low),
    close: clampToNumber(candle.close),
    volume: clampToNumber(candle.volume),
  }));
  const lastCandle = resolvedCandles.at(-1) ?? null;
  const previousCandle = resolvedCandles.at(-2) ?? null;
  const firstCandle = resolvedCandles.at(0) ?? null;
  const livePrice = clampToNumber(snapshot?.lastPrice, Number.NaN);

  if (!lastCandle) {
    return {
      direction: "flat",
      lastPrice: null,
      sessionHigh: null,
      sessionLow: null,
      lastVolume: null,
      priceChangePct: null,
      priceChangeValue: null,
      windowChangePct: null,
      candleCount: 0,
    };
  }

  const resolvedLastPrice = Number.isFinite(livePrice) ? livePrice : lastCandle.close;
  const priceChangeValue = previousCandle
    ? resolvedLastPrice - previousCandle.close
    : resolvedLastPrice - lastCandle.open;
  const comparisonBase = previousCandle?.close ?? lastCandle.open ?? resolvedLastPrice;
  const priceChangePct = comparisonBase === 0
    ? 0
    : (priceChangeValue / comparisonBase) * 100;
  const windowBase = firstCandle?.open ?? lastCandle.open ?? 0;
  const windowChangePct = windowBase === 0
    ? 0
    : ((resolvedLastPrice - windowBase) / windowBase) * 100;

  return {
    direction:
      priceChangeValue > 0 ? "up" : priceChangeValue < 0 ? "down" : "flat",
    lastPrice: resolvedLastPrice,
    sessionHigh: Math.max(...resolvedCandles.map((candle) => candle.high), resolvedLastPrice),
    sessionLow: Math.min(...resolvedCandles.map((candle) => candle.low), resolvedLastPrice),
    lastVolume: lastCandle.volume,
    priceChangePct,
    priceChangeValue,
    windowChangePct,
    candleCount: resolvedCandles.length,
  };
}

function applyToneClass(element, baseClassName, tone) {
  if (!element) {
    return;
  }

  element.className = `${baseClassName} is-${tone}`;
}

function applyDirectionClass(element, baseClassName, direction) {
  if (!element) {
    return;
  }

  element.className = `${baseClassName} is-${direction}`;
}

function resolveSummaryLabel(snapshot, metrics) {
  if (!snapshot) {
    return "샘플 캔들 48개";
  }

  if (snapshot.error) {
    return snapshot.error.message;
  }

  if (metrics.candleCount === 0) {
    return "Binance Spot 실시간 차트";
  }

  const streamLabel = snapshot.lastPriceSource === "ticker"
    ? "현재가 반영"
    : snapshot.lastUpdatedFrom === "stream"
      ? "실시간 반영"
      : snapshot.lastUpdatedFrom === "rest"
      ? "시드 로딩 완료"
      : "스트림 대기";

  return `캔들 ${metrics.candleCount}개 · ${streamLabel} · 구간 ${formatSignedPercent(metrics.windowChangePct)}`;
}

function getTimeframeSelectorMarkup(activeTimeframe, { isOpen = false } = {}) {
  return `
    <div class="chart-card__timeframe-selector">
      <button
        type="button"
        class="chart-card__badge chart-card__badge--timeframe chart-card__badge-button${isOpen ? " is-open" : ""}"
        data-action="toggle-timeframe-menu"
        aria-expanded="${isOpen}"
        aria-haspopup="listbox"
      >
        <span>${activeTimeframe}</span>
        <span class="chart-card__badge-caret" aria-hidden="true"></span>
      </button>
      <div
        class="chart-card__timeframe-menu${isOpen ? " is-open" : ""}"
        data-role="timeframe-menu"
        role="listbox"
        aria-hidden="${isOpen ? "false" : "true"}"
      >
        ${getMonitoringTimeframeOptions().map((option) => `
          <button
            type="button"
            class="chart-card__timeframe-option${option.value === activeTimeframe ? " is-active" : ""}"
            data-action="select-timeframe"
            data-timeframe="${option.value}"
            aria-pressed="${option.value === activeTimeframe}"
          >
            <strong>${option.value}</strong>
            <span>${getMonitoringTimeframeLabel(option.value)}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function getAlertPopoverMarkup({
  alerts = [],
  unreadCount = 0,
  isOpen = false,
} = {}) {
  return `
    <div class="chart-card__alert-popover${isOpen ? " is-open" : ""}" aria-hidden="${isOpen ? "false" : "true"}">
      <div class="chart-card__alert-popover-header">
        <div>
          <strong>실시간 알림</strong>
          <span>미확인 ${unreadCount}건</span>
        </div>
        <button
          type="button"
          class="chart-card__alert-popover-link"
          data-action="open-alert-drawer"
        >
          전체 보기
        </button>
      </div>
      <div class="chart-card__alert-popover-body">
        ${
          alerts.length > 0
            ? alerts
                .slice(0, 3)
                .map(
                  (alert) => `
                    <article class="chart-card__alert-item${alert.status === "new" ? " is-new" : ""}">
                      <div class="chart-card__alert-item-main">
                        <p>${escapeHtml(alert.symbol)} · ${escapeHtml(alert.timeframe)} · ${escapeHtml(
                          formatAlertDetectedAt(alert.detectedAt),
                        )}</p>
                        <strong>${escapeHtml(alert.formulaName)}</strong>
                        <span>${escapeHtml(alert.explanation || "조건 일치가 감지되었습니다.")}</span>
                      </div>
                      <div class="chart-card__alert-item-actions">
                        <button
                          type="button"
                          class="chart-card__alert-action"
                          data-action="acknowledge-alert"
                          data-alert-id="${escapeHtml(alert.id)}"
                        >
                          확인
                        </button>
                        <button
                          type="button"
                          class="chart-card__alert-action chart-card__alert-action--primary"
                          data-action="apply-alert"
                          data-alert-id="${escapeHtml(alert.id)}"
                        >
                          주문 적용
                        </button>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : `
              <div class="chart-card__alert-empty">
                <strong>아직 감지된 신호가 없습니다.</strong>
                <span>공식이 일치하면 여기에 바로 쌓입니다.</span>
              </div>
            `
        }
      </div>
    </div>
  `;
}

export function createChartCard(panel, {
  marketData = null,
  alertStore = null,
  orderPanel = null,
  orderLedger = null,
  activeTab = "chart",
  isFavorite = false,
  onSelectTimeframe = null,
  onTabChange = null,
  onApplyAlert = null,
  onOpenAlerts = null,
  onOpenMarketPicker = null,
  onToggleFavorite = null,
  onOpenDrawer = null,
} = {}) {
  const card = document.createElement("article");
  const marketLabel = getMarketLabel(panel.symbol);
  card.className = "chart-card";
  card.dataset.symbol = panel.symbol;
  card.dataset.timeframe = panel.timeframe;
  card.dataset.routeKey = panel.routeKey ?? `${panel.symbol}:${panel.timeframe}`;
  card.style.setProperty("--chart-accent", panel.accent);

  card.innerHTML = `
    <div class="chart-card__chrome">
      <button
        class="chart-card__market chart-card__market-button"
        type="button"
        aria-label="${marketLabel.name} 종목 선택 열기"
        data-action="open-market-picker"
      >
        <span class="chart-card__market-text">
          <strong>${marketLabel.name}</strong>
          <span>${marketLabel.pair}</span>
        </span>
        <span class="chart-card__market-caret" aria-hidden="true"></span>
      </button>
      <div class="chart-card__actions">
        <button
          class="chart-card__icon-button chart-card__icon-button--favorite${isFavorite ? " is-active" : ""}"
          type="button"
          aria-label="${isFavorite ? "관심 종목 해제" : "관심 종목 추가"}"
          aria-pressed="${isFavorite}"
          data-action="toggle-favorite"
        >
          <svg
            class="chart-card__icon-svg"
            viewBox="0 0 24 24"
            fill="${isFavorite ? "currentColor" : "none"}"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m12 3 2.6 5.2 5.7.8-4.1 4 1 5.7L12 16l-5.2 2.7 1-5.7-4.1-4 5.7-.8L12 3Z" />
          </svg>
        </button>
        <div class="chart-card__action-anchor" data-role="alert-anchor">
          <button
            class="chart-card__icon-button chart-card__icon-button--alert"
            type="button"
            aria-label="알림 열기"
            aria-expanded="false"
            data-action="toggle-alert-popover"
          >
            <svg
              class="chart-card__icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M15 17h5l-1.4-1.6a2 2 0 0 1-.5-1.3V10a6 6 0 1 0-12 0v4.1a2 2 0 0 1-.5 1.3L4 17h5" />
              <path d="M10 17a2 2 0 0 0 4 0" />
            </svg>
            <span class="chart-card__icon-dot" data-role="alert-dot" hidden></span>
          </button>
        </div>
        <button
          class="chart-card__icon-button chart-card__icon-button--menu"
          type="button"
          aria-label="도구 서랍 열기"
          data-action="open-drawer"
        >
          <span class="chart-card__menu-icon" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
      </div>
    </div>
    <div class="chart-card__quote">
      <div class="chart-card__quote-price">
        <strong class="chart-card__price" data-role="last-price">--</strong>
        <div class="chart-card__delta-row">
          <span class="chart-card__change is-flat" data-role="price-change">--</span>
          <span class="chart-card__change-amount is-flat" data-role="price-change-amount">--</span>
        </div>
      </div>
      <div class="chart-card__quote-meta">
        <span class="chart-card__badge chart-card__badge--brand">${APP_BRAND_BADGE}</span>
        <div data-role="timeframe-selector-slot"></div>
        <span class="chart-card__state-pill" data-role="stream-pill">WAIT</span>
      </div>
    </div>
    <div class="chart-card__tabs" role="tablist" aria-label="거래 화면 탭" data-role="tabs-slot"></div>
    <div class="chart-card__content-shell">
      <section class="chart-card__tab-panel chart-card__tab-panel--chart" data-role="chart-panel">
        <div class="chart-card__indicator-bar">
          <span class="chart-card__indicator-label">이동평균선</span>
          <span class="chart-card__indicator-pill chart-card__indicator-pill--ma7">7</span>
          <span class="chart-card__indicator-pill chart-card__indicator-pill--ma20">20</span>
          <span class="chart-card__indicator-pill chart-card__indicator-pill--ma60">60</span>
          <span
            class="chart-card__indicator-pill chart-card__indicator-pill--signal"
            data-role="alert-target"
            hidden
          >
            선택 신호
          </span>
        </div>
        <div class="chart-card__stats">
          <div>
            <dt>고가</dt>
            <dd data-role="session-high">--</dd>
          </div>
          <div>
            <dt>저가</dt>
            <dd data-role="session-low">--</dd>
          </div>
          <div>
            <dt>거래량</dt>
            <dd data-role="last-volume">--</dd>
          </div>
        </div>
        <div class="chart-card__trade-strip">
          <div>
            <dt>보유</dt>
            <dd data-role="position-size">--</dd>
          </div>
          <div>
            <dt>평단</dt>
            <dd data-role="average-entry">--</dd>
          </div>
          <div>
            <dt>최근 진입</dt>
            <dd data-role="latest-entry">--</dd>
          </div>
          <div>
            <dt>평가 손익</dt>
            <dd class="is-flat" data-role="unrealized-pnl">--</dd>
          </div>
        </div>
        <div class="chart-card__stage">
          <div class="chart-card__zoom-controls" aria-label="차트 확대 축소">
            <button type="button" class="chart-card__zoom-button" data-action="zoom-in">+</button>
            <button type="button" class="chart-card__zoom-button" data-action="zoom-out">−</button>
            <button type="button" class="chart-card__zoom-button" data-action="zoom-reset">⌂</button>
          </div>
          <span class="chart-card__zoom-level" data-role="zoom-level">x1.0</span>
          <div
            class="chart-card__chart-surface"
            role="img"
            aria-label="${marketLabel.name} ${panel.timeframe} 실시간 캔들 차트"
          ></div>
          <div class="chart-card__chart-overlay" data-role="chart-overlay" hidden></div>
        </div>
      </section>
      <section
        class="chart-card__tab-panel chart-card__tab-panel--detail"
        data-role="detail-panel"
        hidden
      ></section>
    </div>
    <div class="chart-card__footer">
      <span data-role="status">데모 프리뷰</span>
      <span data-role="summary">샘플 캔들 48개</span>
    </div>
    <div class="chart-card__floating-layer" data-role="floating-layer">
      <div data-role="alert-popover-slot"></div>
    </div>
  `;

  const chartSurface = card.querySelector(".chart-card__chart-surface");
  const stage = card.querySelector(".chart-card__stage");
  const chartPanel = card.querySelector('[data-role="chart-panel"]');
  const detailPanel = card.querySelector('[data-role="detail-panel"]');
  const tabsSlot = card.querySelector('[data-role="tabs-slot"]');
  const chartOverlay = card.querySelector('[data-role="chart-overlay"]');
  const streamPill = card.querySelector('[data-role="stream-pill"]');
  const quotePriceElement = card.querySelector(".chart-card__quote-price");
  const lastPriceElement = card.querySelector('[data-role="last-price"]');
  const priceChangeElement = card.querySelector('[data-role="price-change"]');
  const priceChangeAmountElement = card.querySelector(
    '[data-role="price-change-amount"]',
  );
  const sessionHighElement = card.querySelector('[data-role="session-high"]');
  const sessionLowElement = card.querySelector('[data-role="session-low"]');
  const lastVolumeElement = card.querySelector('[data-role="last-volume"]');
  const positionSizeElement = card.querySelector('[data-role="position-size"]');
  const averageEntryElement = card.querySelector('[data-role="average-entry"]');
  const latestEntryElement = card.querySelector('[data-role="latest-entry"]');
  const unrealizedPnlElement = card.querySelector('[data-role="unrealized-pnl"]');
  const statusElement = card.querySelector('[data-role="status"]');
  const summaryElement = card.querySelector('[data-role="summary"]');
  const alertTargetBadge = card.querySelector('[data-role="alert-target"]');
  const zoomLevelElement = card.querySelector('[data-role="zoom-level"]');
  const alertPopoverSlot = card.querySelector('[data-role="alert-popover-slot"]');
  const alertDot = card.querySelector('[data-role="alert-dot"]');
  const alertButton = card.querySelector('[data-action="toggle-alert-popover"]');
  const favoriteButton = card.querySelector('[data-action="toggle-favorite"]');
  let favoriteActive = Boolean(isFavorite);

  const renderer = createLightweightChartRenderer(chartSurface, panel, {
    overlayElement: chartOverlay,
  });
  const handleViewportResize = () => {
    renderer.resize();
    if (isAlertPopoverOpen) {
      renderAlertPopover();
    }
  };
  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => {
        renderer.resize();
      })
    : null;

  globalThis?.addEventListener?.("resize", handleViewportResize);
  resizeObserver?.observe(stage);
  requestAnimationFrame(() => {
    renderer.resize();
  });

  let unsubscribe = null;
  let priceMotionTimer = 0;
  let panelMotionTimer = 0;
  let lastTickDirection = "flat";
  let pinchDistance = 0;
  let isTimeframeMenuOpen = false;
  let isAlertPopoverOpen = false;
  let currentTab = activeTab;
  let ledgerState = orderLedger?.getState?.() ?? {
    availableCash: 0,
    currency: "USDT",
    orders: [],
  };
  let alertState = alertStore?.getState?.() ?? {
    selectedAlertId: null,
    items: [],
  };
  let lastSnapshot = null;
  let lastMetrics = calculateMetrics(null);

  const getTouchDistance = (touches) => {
    if (!touches || touches.length < 2) {
      return 0;
    }

    const [firstTouch, secondTouch] = touches;
    const deltaX = secondTouch.clientX - firstTouch.clientX;
    const deltaY = secondTouch.clientY - firstTouch.clientY;

    return Math.hypot(deltaX, deltaY);
  };

  const pulsePriceMotion = (direction) => {
    if (direction === "flat" || !quotePriceElement || isAlertPopoverOpen) {
      return;
    }

    if (priceMotionTimer) {
      clearTimeout(priceMotionTimer);
    }

    quotePriceElement.classList.remove("is-price-tick-up", "is-price-tick-down");
    const nextClassName = direction === "up" ? "is-price-tick-up" : "is-price-tick-down";

    void quotePriceElement.offsetWidth;
    quotePriceElement.classList.add(nextClassName);
    priceMotionTimer = setTimeout(() => {
      quotePriceElement.classList.remove(nextClassName);
      priceMotionTimer = 0;
    }, 520);
  };

  const syncZoomState = () => {
    const zoomState = renderer.getZoomState();
    const zoomRatio = zoomState.maxVisibleCount / zoomState.visibleCount;
    zoomLevelElement.textContent = `x${zoomRatio.toFixed(1)}`;
  };

  const renderTimeframeSelector = () => {
    const host = card.querySelector('[data-role="timeframe-selector-slot"]');

    if (!host) {
      return;
    }

    host.innerHTML = getTimeframeSelectorMarkup(panel.timeframe, {
      isOpen: isTimeframeMenuOpen,
    });
  };

  const renderTabs = () => {
    if (!tabsSlot) {
      return;
    }

    tabsSlot.innerHTML = getChartCardTabsMarkup(currentTab);
  };

  const getLatestAlert = () =>
    alertState.items.find(
      (item) => item.symbol === panel.symbol && item.timeframe === panel.timeframe,
    ) ?? alertState.items[0] ?? null;

  const getTradePerformance = (marketPrice = lastMetrics.lastPrice) => (
    summarizeOrderPerformance({
      orders: ledgerState.orders,
      symbol: panel.symbol,
      marketPrice,
    })
  );

  const renderTradePerformance = (marketPrice = lastMetrics.lastPrice) => {
    const performance = getTradePerformance(marketPrice);
    const position = performance.position;
    const markers = buildTradeMarkers({
      orders: ledgerState.orders,
      symbol: panel.symbol,
    });

    positionSizeElement.textContent = position.quantity > 0
      ? `${position.quantity.toFixed(6)} BTC`
      : "--";
    averageEntryElement.textContent = position.avgEntryPrice == null
      ? "--"
      : renderer.formatPrice(position.avgEntryPrice);
    latestEntryElement.textContent = formatTradeTimestamp(position.latestEntryAt);
    unrealizedPnlElement.textContent = position.unrealizedPnl == null
      ? "--"
      : formatSignedPrice(position.unrealizedPnl, renderer.formatPrice);
    applyDirectionClass(
      unrealizedPnlElement,
      "chart-card__trade-value",
      position.unrealizedPnl > 0
        ? "up"
        : position.unrealizedPnl < 0
          ? "down"
          : "flat",
    );

    renderer.setTradeAnnotations({
      markers,
      averageEntryPrice: position.avgEntryPrice,
    });

    return performance;
  };

  const playPanelMotion = (element, className) => {
    if (!element) {
      return;
    }

    if (panelMotionTimer) {
      clearTimeout(panelMotionTimer);
      panelMotionTimer = 0;
    }

    chartPanel.classList.remove("is-entering-chart");
    detailPanel.classList.remove("is-entering-detail");
    void element.offsetWidth;
    element.classList.add(className);
    panelMotionTimer = setTimeout(() => {
      element.classList.remove(className);
      panelMotionTimer = 0;
    }, 320);
  };

  const renderDetailPanel = ({ animate = true } = {}) => {
    const isChartTab = currentTab === "chart";

    chartPanel.hidden = false;
    detailPanel.hidden = isChartTab;
    card.classList.toggle("is-detail-tab", !isChartTab);

    if (isChartTab) {
      detailPanel.replaceChildren();
      if (animate) {
        playPanelMotion(chartPanel, "is-entering-chart");
      }
      requestAnimationFrame(() => {
        renderer.resize();
        syncZoomState();
      });
      return;
    }

    requestAnimationFrame(() => {
      renderer.resize();
      syncZoomState();
    });

    if (currentTab === "order" && orderPanel) {
      detailPanel.className = "chart-card__tab-panel chart-card__tab-panel--detail is-order";
      detailPanel.replaceChildren(orderPanel);
      if (animate) {
        playPanelMotion(detailPanel, "is-entering-detail");
      }
      return;
    }

    if (currentTab === "orderbook") {
      detailPanel.className = "chart-card__tab-panel chart-card__tab-panel--detail is-orderbook";
      detailPanel.innerHTML = getOrderbookPanelMarkup({
        lastPrice: lastMetrics.lastPrice,
        formatter: renderer.formatPrice,
      });
      if (animate) {
        playPanelMotion(detailPanel, "is-entering-detail");
      }
      return;
    }

    if (currentTab === "market") {
      detailPanel.className = "chart-card__tab-panel chart-card__tab-panel--detail is-market";
      const performance = getTradePerformance();
      detailPanel.innerHTML = getMarketSnapshotPanelMarkup({
        panel,
        metrics: lastMetrics,
        performance,
        statusLabel: resolveStatusLabel(lastSnapshot),
        summaryLabel: resolveSummaryLabel(lastSnapshot, lastMetrics),
        latestAlert: getLatestAlert(),
        formatter: renderer.formatPrice,
        volumeFormatter: renderer.formatCompactVolume,
      });
      if (animate) {
        playPanelMotion(detailPanel, "is-entering-detail");
      }
      return;
    }

    detailPanel.className = "chart-card__tab-panel chart-card__tab-panel--detail is-info";
    detailPanel.innerHTML = getFormulaInfoPanelMarkup({
      timeframe: panel.timeframe,
    });
    if (animate) {
      playPanelMotion(detailPanel, "is-entering-detail");
    }
  };

  const setActiveTabState = (nextTab) => {
    if (typeof nextTab !== "string" || nextTab.length === 0) {
      return false;
    }

    if (nextTab === currentTab) {
      return false;
    }

    currentTab = nextTab;
    renderTabs();
    renderDetailPanel();
    onTabChange?.(currentTab);
    return true;
  };

  const renderAlertPopover = () => {
    const unreadCount = alertState.items.filter((item) => item.status === "new").length;

    alertDot.hidden = unreadCount === 0;
    alertButton?.setAttribute("aria-expanded", isAlertPopoverOpen ? "true" : "false");

    if (isAlertPopoverOpen) {
      if (priceMotionTimer) {
        clearTimeout(priceMotionTimer);
        priceMotionTimer = 0;
      }
      quotePriceElement?.classList.remove("is-price-tick-up", "is-price-tick-down");
    }

    if (!alertPopoverSlot) {
      return;
    }

    alertPopoverSlot.innerHTML = getAlertPopoverMarkup({
      alerts: alertState.items,
      unreadCount,
      isOpen: isAlertPopoverOpen,
    });

    const alertAnchor = card.querySelector('[data-role="alert-anchor"]');
    const popover = alertPopoverSlot.firstElementChild;

    if (!alertAnchor || !(popover instanceof HTMLElement)) {
      return;
    }

    const anchorRect = alertAnchor.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    popover.style.top = `${Math.max(0, anchorRect.bottom - cardRect.top + 6)}px`;
    popover.style.right = `${Math.max(0, cardRect.right - anchorRect.right)}px`;
  };

  const renderFavoriteState = () => {
    if (!favoriteButton) {
      return;
    }

    favoriteButton.classList.toggle("is-active", favoriteActive);
    favoriteButton.setAttribute(
      "aria-label",
      favoriteActive ? "관심 종목 해제" : "관심 종목 추가",
    );
    favoriteButton.setAttribute("aria-pressed", favoriteActive ? "true" : "false");

    const icon = favoriteButton.querySelector("svg");

    if (icon) {
      icon.setAttribute("fill", favoriteActive ? "currentColor" : "none");
    }
  };

  const handleDocumentClick = (event) => {
    const host = card.querySelector('[data-role="timeframe-selector-slot"]');
    const alertAnchor = card.querySelector('[data-role="alert-anchor"]');
    const clickedInsideTimeframe = Boolean(
      host &&
      event.target instanceof Node &&
      host.contains(event.target),
    );
    const clickedInsideAlertAnchor = Boolean(
      alertAnchor &&
      event.target instanceof Node &&
      alertAnchor.contains(event.target),
    );

    if (!isTimeframeMenuOpen && !isAlertPopoverOpen) {
      return;
    }

    if (isTimeframeMenuOpen && !clickedInsideTimeframe) {
      isTimeframeMenuOpen = false;
      renderTimeframeSelector();
    }

    if (isAlertPopoverOpen && !clickedInsideAlertAnchor) {
      isAlertPopoverOpen = false;
      renderAlertPopover();
    }
  };

  globalThis?.addEventListener?.("click", handleDocumentClick);

  const syncMetrics = (snapshot) => {
    const metrics = calculateMetrics(snapshot);
    const formatter = renderer.formatPrice;
    const volumeFormatter = renderer.formatCompactVolume;
    lastMetrics = metrics;
    lastSnapshot = snapshot;

    orderPanel?.setMarketSnapshot?.({
      lastPrice: metrics.lastPrice,
    });

    lastPriceElement.textContent = metrics.lastPrice == null
      ? "--"
      : formatter(metrics.lastPrice);
    priceChangeElement.textContent = formatSignedPercent(metrics.priceChangePct);
    priceChangeAmountElement.textContent = formatSignedPrice(
      metrics.priceChangeValue,
      formatter,
    );
    sessionHighElement.textContent = metrics.sessionHigh == null
      ? "--"
      : formatter(metrics.sessionHigh);
    sessionLowElement.textContent = metrics.sessionLow == null
      ? "--"
      : formatter(metrics.sessionLow);
    lastVolumeElement.textContent = metrics.lastVolume == null
      ? "--"
      : volumeFormatter(metrics.lastVolume);
    statusElement.textContent = resolveStatusLabel(snapshot);
    summaryElement.textContent = resolveSummaryLabel(snapshot, metrics);

    applyToneClass(streamPill, "chart-card__state-pill", resolvePillTone(snapshot));
    streamPill.textContent = resolvePillLabel(snapshot);
    applyDirectionClass(lastPriceElement, "chart-card__price", metrics.direction);
    applyDirectionClass(priceChangeElement, "chart-card__change", metrics.direction);
    applyDirectionClass(
      priceChangeAmountElement,
      "chart-card__change-amount",
      metrics.direction,
    );
    renderTradePerformance(metrics.lastPrice);
    card.dataset.direction = metrics.direction;

    if (metrics.direction !== "flat" && metrics.direction !== lastTickDirection) {
      pulsePriceMotion(metrics.direction);
      lastTickDirection = metrics.direction;
      return;
    }

    if (metrics.direction !== "flat" && snapshot?.lastUpdatedFrom === "stream") {
      pulsePriceMotion(metrics.direction);
    }

    if (currentTab === "market" || currentTab === "orderbook" || currentTab === "info") {
      renderDetailPanel({ animate: false });
    }
  };

  const handleSnapshot = (snapshot) => {
    syncMetrics(snapshot);
    renderer.setData({
      candles: snapshot?.candles ?? [],
      nextOverlayLabel: resolveOverlayLabel(snapshot),
      isStreaming: snapshot?.status === "streaming",
    });
    syncZoomState();
  };

  const unsubscribeAlertStore = alertStore?.subscribe?.((nextState) => {
    alertState = nextState;
    renderAlertPopover();

    if (currentTab === "market" || currentTab === "info") {
      renderDetailPanel({ animate: false });
    }
  });

  const unsubscribeOrderLedger = orderLedger?.subscribe?.((nextState) => {
    ledgerState = nextState;
    renderTradePerformance(lastMetrics.lastPrice);

    if (currentTab === "market") {
      renderDetailPanel({ animate: false });
    }
  }, {
    emitCurrent: false,
  });

  stage.addEventListener("wheel", (event) => {
    event.preventDefault();

    if (event.deltaY < 0) {
      renderer.zoomIn();
    } else {
      renderer.zoomOut();
    }

    syncZoomState();
  }, { passive: false });

  stage.addEventListener("dblclick", () => {
    renderer.resetZoom();
    syncZoomState();
  });

  stage.addEventListener("touchstart", (event) => {
    if (event.touches.length < 2) {
      pinchDistance = 0;
      return;
    }

    pinchDistance = getTouchDistance(event.touches);
  }, { passive: true });

  stage.addEventListener("touchmove", (event) => {
    if (event.touches.length < 2) {
      pinchDistance = 0;
      return;
    }

    const nextDistance = getTouchDistance(event.touches);

    if (!pinchDistance) {
      pinchDistance = nextDistance;
      return;
    }

    const zoomRatio = nextDistance / pinchDistance;

    if (zoomRatio > 1.06) {
      event.preventDefault();
      renderer.zoomIn();
      pinchDistance = nextDistance;
      syncZoomState();
      return;
    }

    if (zoomRatio < 0.94) {
      event.preventDefault();
      renderer.zoomOut();
      pinchDistance = nextDistance;
      syncZoomState();
    }
  }, { passive: false });

  stage.addEventListener("touchend", () => {
    pinchDistance = 0;
  }, { passive: true });

  card.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");

    if (!trigger || !(trigger instanceof HTMLElement)) {
      return;
    }

    if (trigger.dataset.action === "zoom-in") {
      renderer.zoomIn();
      syncZoomState();
      return;
    }

    if (trigger.dataset.action === "zoom-out") {
      renderer.zoomOut();
      syncZoomState();
      return;
    }

    if (trigger.dataset.action === "zoom-reset") {
      renderer.resetZoom();
      syncZoomState();
      return;
    }

    if (trigger.dataset.action === "set-tab" && trigger.dataset.tab) {
      setActiveTabState(trigger.dataset.tab);
      return;
    }

    if (trigger.dataset.action === "toggle-timeframe-menu") {
      event.stopPropagation();
      isAlertPopoverOpen = false;
      renderAlertPopover();
      isTimeframeMenuOpen = !isTimeframeMenuOpen;
      renderTimeframeSelector();
      return;
    }

    if (trigger.dataset.action === "select-timeframe" && trigger.dataset.timeframe) {
      event.stopPropagation();
      isTimeframeMenuOpen = false;
      renderTimeframeSelector();
      onSelectTimeframe?.(trigger.dataset.timeframe);
      return;
    }

    if (trigger.dataset.action === "toggle-alert-popover") {
      event.stopPropagation();
      isTimeframeMenuOpen = false;
      renderTimeframeSelector();
      isAlertPopoverOpen = !isAlertPopoverOpen;
      renderAlertPopover();
      return;
    }

    if (trigger.dataset.action === "toggle-favorite") {
      onToggleFavorite?.(panel.symbol);
      return;
    }

    if (trigger.dataset.action === "open-alert-drawer") {
      isAlertPopoverOpen = false;
      renderAlertPopover();
      onOpenAlerts?.();
      return;
    }

    if (trigger.dataset.action === "acknowledge-alert" && trigger.dataset.alertId) {
      alertStore?.acknowledge?.(trigger.dataset.alertId);
      return;
    }

    if (trigger.dataset.action === "apply-alert" && trigger.dataset.alertId) {
      const alert = alertState.items.find((item) => item.id === trigger.dataset.alertId);

      if (!alert) {
        return;
      }

      alertStore?.selectAlert?.(alert.id);
      alertStore?.acknowledge?.(alert.id);
      isAlertPopoverOpen = false;
      renderAlertPopover();
      onApplyAlert?.(alert);
      return;
    }

    if (trigger.dataset.action === "open-drawer") {
      onOpenDrawer?.();
      return;
    }

    if (trigger.dataset.action === "open-market-picker") {
      onOpenMarketPicker?.();
    }
  });

  if (marketData) {
    unsubscribe = marketData.subscribe(panel, (snapshot) => {
      handleSnapshot(snapshot);
    });
  } else {
    handleSnapshot({
      candles: generateMockCandles(panel),
      status: "ready",
      lastUpdatedFrom: "mock",
      error: null,
    });
  }

  card.setAlertState = ({ isMatched = false, navigationPayload = null } = {}) => {
    card.classList.toggle("is-alert-target", isMatched);
    alertTargetBadge.hidden = !isMatched;

    if (!isMatched || !navigationPayload) {
      alertTargetBadge.textContent = "선택 신호";
      return;
    }

    alertTargetBadge.textContent = `${navigationPayload.params.symbol} ${navigationPayload.params.timeframe}`;
  };

  card.setFavoriteState = (nextFavorite) => {
    favoriteActive = Boolean(nextFavorite);
    renderFavoriteState();
    return favoriteActive;
  };

  card.destroy = () => {
    if (priceMotionTimer) {
      clearTimeout(priceMotionTimer);
      priceMotionTimer = 0;
    }
    if (panelMotionTimer) {
      clearTimeout(panelMotionTimer);
      panelMotionTimer = 0;
    }
    globalThis?.removeEventListener?.("resize", handleViewportResize);
    globalThis?.removeEventListener?.("click", handleDocumentClick);
    resizeObserver?.disconnect();
    unsubscribeAlertStore?.();
    unsubscribeOrderLedger?.();
    unsubscribe?.();
    renderer.destroy();
  };

  card.refresh = () => {
    renderer.refresh();
    syncZoomState();
  };

  card.setActiveTab = (nextTab) => setActiveTabState(nextTab);

  syncZoomState();
  renderTimeframeSelector();
  renderTradePerformance(lastMetrics.lastPrice);
  renderAlertPopover();
  renderFavoriteState();
  renderTabs();
  renderDetailPanel();

  return card;
}
