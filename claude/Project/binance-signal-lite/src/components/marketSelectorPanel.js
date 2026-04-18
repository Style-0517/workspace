import { getMonitoringTimeframeLabel } from "../config/monitoringTimeframes.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMarketButton(market, activeSymbol, timeframe) {
  const isActive = market.symbol === activeSymbol;

  return `
    <button
      type="button"
      class="market-selector-panel__button${isActive ? " is-active" : ""}"
      data-symbol="${escapeHtml(market.symbol)}"
      aria-pressed="${isActive}"
    >
      <strong>${escapeHtml(market.label)}</strong>
      <span class="market-selector-panel__symbol">${escapeHtml(market.symbol)}</span>
      <span class="market-selector-panel__meta">${escapeHtml(getMonitoringTimeframeLabel(timeframe))} 기준 차트 열기</span>
    </button>
  `;
}

export function getMarketSelectorPanelMarkup({
  markets = [],
  activeSymbol = "",
  timeframe = "1m",
} = {}) {
  return `
    <div class="market-selector-panel__header">
      <div>
        <p class="market-selector-panel__eyebrow">종목</p>
        <h2>볼 종목 고르기</h2>
      </div>
    </div>
    <p class="market-selector-panel__description">
      화면 맨 위 탭 대신 여기서 종목을 바꾸고 바로 차트로 돌아갑니다.
    </p>
    <div class="market-selector-panel__grid">
      ${markets.map((market) => renderMarketButton(market, activeSymbol, timeframe)).join("")}
    </div>
  `;
}

export function createMarketSelectorPanel({
  markets = [],
  activeSymbol = "",
  timeframe = "1m",
  onSelect = null,
} = {}) {
  const panel = document.createElement("section");
  panel.className = "market-selector-panel";

  let currentSymbol = activeSymbol;
  let currentTimeframe = timeframe;

  const render = () => {
    panel.innerHTML = getMarketSelectorPanelMarkup({
      markets,
      activeSymbol: currentSymbol,
      timeframe: currentTimeframe,
    });
  };

  panel.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-symbol]");

    if (!trigger || !(trigger instanceof HTMLElement) || !trigger.dataset.symbol) {
      return;
    }

    currentSymbol = trigger.dataset.symbol;
    render();
    onSelect?.(currentSymbol);
  });

  panel.setContext = ({
    activeSymbol: nextSymbol = currentSymbol,
    timeframe: nextTimeframe = currentTimeframe,
  } = {}) => {
    currentSymbol = nextSymbol;
    currentTimeframe = nextTimeframe;
    render();
  };

  render();

  return panel;
}
