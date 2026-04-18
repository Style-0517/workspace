import { APP_BRAND_BADGE } from "../config/branding.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPair(symbol) {
  if (typeof symbol !== "string") {
    return "";
  }

  if (symbol.endsWith("USDT")) {
    return `${symbol.slice(0, -4)} / USDT`;
  }

  return symbol;
}

function createMarketSectionMarkup({
  title,
  markets = [],
  activeSymbol = "",
  emptyMessage = "표시할 종목이 없습니다.",
} = {}) {
  return `
    <section class="market-picker-screen__section">
      <div class="market-picker-screen__section-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(String(markets.length))}개</span>
      </div>
      ${
        markets.length > 0
          ? `
            <div class="market-picker-screen__list">
              ${markets.map((market) => {
                const isActive = market.symbol === activeSymbol;

                return `
                  <button
                    type="button"
                    class="market-picker-screen__item${isActive ? " is-active" : ""}"
                    data-action="select-market"
                    data-symbol="${escapeHtml(market.symbol)}"
                    aria-pressed="${isActive}"
                    aria-current="${isActive ? "true" : "false"}"
                  >
                    <div class="market-picker-screen__item-main">
                      <strong>${escapeHtml(market.label)}</strong>
                      <span>${escapeHtml(formatPair(market.symbol))}</span>
                    </div>
                    <span class="market-picker-screen__item-indicator" aria-hidden="true"></span>
                  </button>
                `;
              }).join("")}
            </div>
          `
          : `
            <div class="market-picker-screen__empty">
              <strong>${escapeHtml(emptyMessage)}</strong>
              <span>상단 별 버튼으로 관심 종목을 추가할 수 있습니다.</span>
            </div>
          `
      }
    </section>
  `;
}

function getMarketPickerMarkup({
  isOpen = false,
  markets = [],
  activeSymbol = "",
  favoriteSymbols = [],
} = {}) {
  const favorites = markets.filter((market) => favoriteSymbols.includes(market.symbol));

  return `
    <div class="market-picker-screen__overlay${isOpen ? " is-open" : ""}" aria-hidden="${isOpen ? "false" : "true"}">
      <div class="market-picker-screen__sheet">
        <div class="market-picker-screen__header">
          <button
            type="button"
            class="market-picker-screen__back"
            data-action="close-market-picker"
            aria-label="종목 선택 닫기"
          >
            ←
          </button>
          <div class="market-picker-screen__title">
            <strong>종목 선택</strong>
          </div>
          <span class="market-picker-screen__badge">${escapeHtml(APP_BRAND_BADGE)}</span>
        </div>
        ${createMarketSectionMarkup({
          title: "관심 종목",
          markets: favorites,
          activeSymbol,
          emptyMessage: "아직 등록된 관심 종목이 없습니다.",
        })}
        ${createMarketSectionMarkup({
          title: "전체 종목",
          markets,
          activeSymbol,
        })}
      </div>
    </div>
  `;
}

export function createMarketPickerScreen({
  markets = [],
  activeSymbol = "",
  favoriteSymbols = [],
  onSelect = null,
} = {}) {
  const screen = document.createElement("section");
  screen.className = "market-picker-screen";

  let isOpen = false;
  let currentMarkets = [...markets];
  let currentSymbol = activeSymbol;
  let currentFavoriteSymbols = [...favoriteSymbols];

  const render = () => {
    screen.innerHTML = getMarketPickerMarkup({
      isOpen,
      markets: currentMarkets,
      activeSymbol: currentSymbol,
      favoriteSymbols: currentFavoriteSymbols,
    });
    screen.setAttribute("aria-hidden", isOpen ? "false" : "true");
  };

  screen.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");

    if (!trigger || !(trigger instanceof HTMLElement)) {
      return;
    }

    if (trigger.dataset.action === "close-market-picker") {
      isOpen = false;
      render();
      return;
    }

    if (trigger.dataset.action === "select-market" && trigger.dataset.symbol) {
      currentSymbol = trigger.dataset.symbol;
      render();
      onSelect?.(currentSymbol);
      isOpen = false;
      render();
    }
  });

  screen.setOpen = (nextOpen) => {
    const normalizedOpen = Boolean(nextOpen);

    if (normalizedOpen === isOpen) {
      return false;
    }

    isOpen = normalizedOpen;
    render();
    return true;
  };

  screen.setContext = ({
    markets: nextMarkets = currentMarkets,
    activeSymbol: nextSymbol = currentSymbol,
    favoriteSymbols: nextFavoriteSymbols = currentFavoriteSymbols,
  } = {}) => {
    currentMarkets = Array.isArray(nextMarkets) ? [...nextMarkets] : currentMarkets;
    currentSymbol = nextSymbol;
    currentFavoriteSymbols = Array.isArray(nextFavoriteSymbols)
      ? [...nextFavoriteSymbols]
      : currentFavoriteSymbols;
    render();
  };

  render();

  return screen;
}
