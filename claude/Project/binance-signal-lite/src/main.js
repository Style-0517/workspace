import { renderApp } from "./app.js";
import { resolveConfiguredActiveTimeframe } from "./config/monitoringTimeframes.js";
import { createMonitoringChartPanels } from "./data/chartPanels.js";
import { BinanceChartFeed } from "./services/binanceChartFeed.js";
import { BinanceMarketDataClient } from "./services/binanceMarketDataClient.js";

const rootElement = document.querySelector("#app");
if (!rootElement) {
  throw new Error("App root element #app was not found");
}

const marketDataClient = new BinanceMarketDataClient();
const chartFeed = new BinanceChartFeed({
  marketDataClient,
  panels: createMonitoringChartPanels(),
});

renderApp(rootElement, {
  marketData: chartFeed,
  windowRef: window,
  storage: window.localStorage,
  preferenceStorage: window.localStorage,
  activeTimeframe: resolveConfiguredActiveTimeframe({
    windowRef: window,
    storage: window.localStorage,
  }),
});
