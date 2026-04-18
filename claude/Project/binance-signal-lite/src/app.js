import { createAlertInboxPanel } from "./components/alertInboxPanel.js";
import { createChartCard } from "./components/chartCard.js";
import { createChartOrderTicket } from "./components/chartOrderTicket.js";
import { createMarketPickerScreen } from "./components/marketPickerScreen.js";
import { createSettingsPanel } from "./components/settingsPanel.js";
import { createToolDrawer } from "./components/toolDrawer.js";
import { createTradingFormulaPanel } from "./components/tradingFormulaPanel.js";
import { APP_THEME_STORAGE_KEY } from "./config/localStateStorage.js";
import {
  DEFAULT_ACTIVE_SYMBOL,
  MARKET_OPTIONS,
  getMarketLabel,
  isConfiguredMarketSymbol,
} from "./config/marketCatalog.js";
import {
  createChartPanels,
  createMonitoringChartPanels,
} from "./data/chartPanels.js";
import { createBrowserSignalAlertStore } from "./features/alerts/browserSignalAlertStore.js";
import { createBrowserFavoriteMarketStore } from "./features/markets/browserFavoriteMarketStore.js";
import { createMockOrderLedger } from "./features/orders/mockOrderLedger.js";
import { createFormulaMatchMonitor } from "./features/signals/formulaMatchMonitor.js";
import {
  getMonitoringTimeframeLabel,
  persistConfiguredActiveTimeframe,
  resolveConfiguredActiveTimeframe,
} from "./config/monitoringTimeframes.js";
import { BinanceChartFeed } from "./services/binanceChartFeed.js";

function resolveInitialTheme(storage) {
  const storedTheme = typeof storage?.getItem === "function"
    ? storage.getItem(APP_THEME_STORAGE_KEY)
    : null;

  return storedTheme === "dark" ? "dark" : "light";
}

export function renderApp(
  rootElement,
  {
    marketData = null,
    windowRef = globalThis,
    storage = null,
    preferenceStorage = null,
    activeTimeframe = null,
  } = {},
) {
  let resolvedMarketData = marketData;
  const resolvedPreferenceStorage = preferenceStorage ?? storage ?? null;
  const alertStore = createBrowserSignalAlertStore({
    storage: resolvedPreferenceStorage,
  });
  const favoriteMarketStore = createBrowserFavoriteMarketStore({
    storage: resolvedPreferenceStorage,
  });
  const orderLedger = createMockOrderLedger({
    storage: resolvedPreferenceStorage,
  });

  if (!resolvedMarketData) {
    try {
      resolvedMarketData = new BinanceChartFeed({
        panels: createMonitoringChartPanels(),
      });
    } catch (error) {
      console.error("Failed to initialize Binance chart feed", error);
    }
  }

  rootElement.innerHTML = `
    <div class="app-shell">
      <section class="phone-shell">
        <section class="mobile-screen">
          <section class="chart-grid" data-role="chart-grid"></section>
        </section>
        <div data-role="drawer-slot"></div>
        <div data-role="market-picker-slot"></div>
      </section>
    </div>
  `;

  const phoneShell = rootElement.querySelector(".phone-shell");
  const chartGrid = rootElement.querySelector('[data-role="chart-grid"]');
  const drawerSlot = rootElement.querySelector('[data-role="drawer-slot"]');
  const marketPickerSlot = rootElement.querySelector('[data-role="market-picker-slot"]');

  const cardsByRouteKey = new Map();
  let currentTheme = resolveInitialTheme(resolvedPreferenceStorage);
  const orderPanel = createChartOrderTicket({
    orderLedger,
  });
  const formulaPanel = createTradingFormulaPanel();
  const settingsPanel = createSettingsPanel({
    isDarkMode: currentTheme === "dark",
    onToggleDarkMode: (enabled) => {
      currentTheme = enabled ? "dark" : "light";
      applyTheme();

      if (typeof resolvedPreferenceStorage?.setItem === "function") {
        resolvedPreferenceStorage.setItem(APP_THEME_STORAGE_KEY, currentTheme);
      }
    },
  });
  const initialFavoriteState = favoriteMarketStore.getState();
  let currentSymbol = initialFavoriteState.symbols[0] ?? DEFAULT_ACTIVE_SYMBOL;
  let currentTimeframe = resolveConfiguredActiveTimeframe({
    initialTimeframe: activeTimeframe,
    windowRef,
    storage: resolvedPreferenceStorage,
  });
  let currentPanels = createChartPanels({
    timeframe: currentTimeframe,
    symbols: [currentSymbol],
  });
  let currentCardTab = "chart";
  let toolDrawer = null;

  const formulaMatchMonitor = createFormulaMatchMonitor({
    marketData: resolvedMarketData,
    alertStore,
  });

  const applyAlertToOrderFlow = (alert) => {
    if (alert.symbol !== currentSymbol) {
      setActiveSymbol(alert.symbol);
    }

    if (alert.timeframe !== currentTimeframe) {
      setActiveTimeframe(alert.timeframe);
    }

    formulaPanel.setSelectedFormulaId?.(alert.formulaId);
    orderPanel.applyAlert?.(alert);
    syncCardAlertState(alert);
    toolDrawer.setOpen(false);
    setActiveCardTab("order");
  };

  const alertInboxPanel = createAlertInboxPanel({
    alertStore,
    onApply: (alert) => {
      applyAlertToOrderFlow(alert);
    },
  });
  const marketPickerScreen = createMarketPickerScreen({
    markets: MARKET_OPTIONS,
    activeSymbol: currentSymbol,
    favoriteSymbols: initialFavoriteState.symbols,
    onSelect: (nextSymbol) => {
      setActiveSymbol(nextSymbol);
    },
  });

  toolDrawer = createToolDrawer({
    alertPanel: alertInboxPanel,
    formulaPanel,
    settingsPanel,
    initialOpen: false,
    initialSection: "alerts",
    summary: {
      symbol: getMarketLabel(currentSymbol),
      timeframe: getMonitoringTimeframeLabel(currentTimeframe),
      alertCount: "0건",
    },
  });
  drawerSlot.replaceWith(toolDrawer);
  marketPickerSlot.replaceWith(marketPickerScreen);

  const applyTheme = () => {
    phoneShell?.classList.toggle("theme-dark", currentTheme === "dark");
    settingsPanel.setDarkMode?.(currentTheme === "dark");
    cardsByRouteKey.forEach((card) => {
      card.refresh?.();
    });
  };

  const destroyCards = () => {
    cardsByRouteKey.forEach((card) => {
      card.destroy?.();
    });
    cardsByRouteKey.clear();
    chartGrid.replaceChildren();
  };

  const syncOrderContext = () => {
    orderPanel.setContext?.({
      symbol: currentSymbol,
      timeframe: currentTimeframe,
    });
  };

  const getCurrentRouteKey = () => `${currentSymbol}:${currentTimeframe}`;

  const setActiveCardTab = (nextTab) => {
    currentCardTab = nextTab;
    cardsByRouteKey.get(getCurrentRouteKey())?.setActiveTab?.(nextTab);
    return currentCardTab;
  };

  const syncMarketPanelContext = () => {
    marketPickerScreen.setContext?.({
      markets: MARKET_OPTIONS,
      activeSymbol: currentSymbol,
      favoriteSymbols: favoriteMarketStore.getState().symbols,
    });
  };

  const syncDrawerSummary = (state = alertStore.getState()) => {
    const unreadCount = state.items.filter((item) => item.status === "new").length;

    toolDrawer.setSummary({
      symbol: getMarketLabel(currentSymbol),
      timeframe: getMonitoringTimeframeLabel(currentTimeframe),
      alertCount: `${unreadCount}건`,
    });
  };

  const syncCardAlertState = (selectedAlert = alertStore.getSelectedAlert()) => {
    cardsByRouteKey.forEach((card, routeKey) => {
      card.setAlertState?.({
        isMatched:
          selectedAlert != null &&
          routeKey === `${selectedAlert.symbol}:${selectedAlert.timeframe}`,
        navigationPayload:
          selectedAlert == null
            ? null
            : {
                params: {
                  symbol: selectedAlert.symbol,
                  timeframe: selectedAlert.timeframe,
                },
              },
      });
    });
  };

  const syncCardFavoriteState = () => {
    const isFavorite = favoriteMarketStore.includes(currentSymbol);

    cardsByRouteKey.forEach((card) => {
      card.setFavoriteState?.(isFavorite);
    });
  };

  const renderChartPanels = () => {
    destroyCards();

    currentPanels.forEach((panel) => {
      const card = createChartCard(panel, {
        marketData: resolvedMarketData,
        alertStore,
        orderPanel,
        orderLedger,
        activeTab: currentCardTab,
        isFavorite: favoriteMarketStore.includes(panel.symbol),
        onSelectTimeframe: (nextTimeframe) => {
          setActiveTimeframe(nextTimeframe);
        },
        onTabChange: (nextTab) => {
          currentCardTab = nextTab;
        },
        onApplyAlert: (alert) => {
          applyAlertToOrderFlow(alert);
        },
        onOpenAlerts: () => {
          toolDrawer.setActiveSection("alerts");
        },
        onOpenMarketPicker: () => {
          marketPickerScreen.setOpen(true);
        },
        onToggleFavorite: (symbol) => {
          favoriteMarketStore.toggle(symbol);
        },
        onOpenDrawer: () => {
          toolDrawer.setActiveSection("alerts");
        },
      });
      cardsByRouteKey.set(panel.routeKey, card);
      chartGrid.appendChild(card);
    });
  };

  const setActiveSymbol = (nextSymbol) => {
    if (!isConfiguredMarketSymbol(nextSymbol)) {
      return false;
    }

    if (nextSymbol === currentSymbol) {
      syncMarketPanelContext();
      return false;
    }

    currentSymbol = nextSymbol;
    currentPanels = createChartPanels({
      timeframe: currentTimeframe,
      symbols: [currentSymbol],
    });
    syncOrderContext();
    syncMarketPanelContext();
    syncDrawerSummary();
    renderChartPanels();
    syncCardAlertState();
    syncCardFavoriteState();
    return true;
  };

  const setActiveTimeframe = (nextTimeframe) => {
    const nextPanels = createChartPanels({
      timeframe: nextTimeframe,
      symbols: [currentSymbol],
    });
    const nextResolvedTimeframe = nextPanels[0]?.timeframe ?? currentTimeframe;

    if (nextResolvedTimeframe === currentTimeframe) {
      return false;
    }

    currentTimeframe = nextResolvedTimeframe;
    currentPanels = nextPanels;
    persistConfiguredActiveTimeframe(resolvedPreferenceStorage, currentTimeframe);
    syncOrderContext();
    syncMarketPanelContext();
    syncDrawerSummary();
    renderChartPanels();
    syncCardAlertState();
    syncCardFavoriteState();
    return true;
  };

  syncOrderContext();
  syncMarketPanelContext();
  applyTheme();
  syncDrawerSummary();
  renderChartPanels();
  syncCardAlertState();
  syncCardFavoriteState();

  const unsubscribeAlertState = alertStore.subscribe((state) => {
    syncDrawerSummary(state);
    syncCardAlertState(
      state.items.find((item) => item.id === state.selectedAlertId) ?? null,
    );
  });
  const unsubscribeFavoriteState = favoriteMarketStore.subscribe(() => {
    syncMarketPanelContext();
    syncCardFavoriteState();
  });
  formulaMatchMonitor.start();

  resolvedMarketData?.start().catch((error) => {
    console.error("Failed to start Binance chart feed", error);
  });

  const cleanup = () => {
    unsubscribeAlertState?.();
    unsubscribeFavoriteState?.();
    alertInboxPanel.destroy?.();
    orderPanel.destroy?.();
    formulaMatchMonitor.stop();
    destroyCards();
    resolvedMarketData?.stop();
  };

  windowRef?.addEventListener?.("beforeunload", cleanup, { once: true });

  return {
    destroy: cleanup,
  };
}
