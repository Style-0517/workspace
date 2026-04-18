import {
  ColorType,
  CrosshairMode,
  LastPriceAnimationMode,
  LineStyle,
  createChart,
} from "../../node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.mjs";
import { formatSeoulDateTime, formatSeoulTime } from "./seoulTime.js";

const DEFAULT_BAR_SPACING = 10;
const MIN_BAR_SPACING = 5;
const MAX_BAR_SPACING = 24;
const ZOOM_STEP = 1.18;

const INDICATOR_LINES = Object.freeze([
  { period: 7, color: "#d79b18", lineWidth: 1.5 },
  { period: 20, color: "#7d63d9", lineWidth: 1.3 },
  { period: 60, color: "#8b98a8", lineWidth: 1.2 },
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumeric(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function normalizeCandles(candles = []) {
  return candles.map((candle) => ({
    openTime: Number(candle.openTime),
    open: parseNumeric(candle.open),
    high: parseNumeric(candle.high),
    low: parseNumeric(candle.low),
    close: parseNumeric(candle.close),
    volume: parseNumeric(candle.volume),
  }));
}

function resolveDirection(candle, previousCandle = null) {
  if (!candle) {
    return "flat";
  }

  if (previousCandle && candle.close !== previousCandle.close) {
    return candle.close > previousCandle.close ? "up" : "down";
  }

  if (candle.close === candle.open) {
    return "flat";
  }

  return candle.close > candle.open ? "up" : "down";
}

function formatPrice(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (value >= 10000) {
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

function formatCompactVolume(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toFixed(2);
}

function calculateEmaSeries(candles, period) {
  if (candles.length === 0) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  let ema = candles[0].close;

  return candles.map((candle, index) => {
    if (index === 0) {
      ema = candle.close;
    } else {
      ema = (candle.close - ema) * multiplier + ema;
    }

    return {
      time: Math.floor(candle.openTime / 1000),
      value: ema,
    };
  });
}

function readThemePalette(container) {
  const styleTarget = container.closest(".phone-shell") ?? container.ownerDocument?.documentElement;
  const styles = styleTarget ? getComputedStyle(styleTarget) : null;
  const readVar = (name, fallback) => styles?.getPropertyValue(name)?.trim() || fallback;

  return {
    upColor: readVar("--chart-up", "#e05a64"),
    downColor: readVar("--chart-down", "#2f6bff"),
    neutralText: readVar("--chart-neutral", "#737d8c"),
    gridColor: readVar("--chart-grid", "#edf1f5"),
    stageBackground: readVar("--chart-stage-background", "#ffffff"),
    stageLineColor: readVar("--chart-stage-line", "#dbe2ea"),
    axisLabelColor: readVar("--chart-axis-text", "#8791a0"),
    priceTagText: readVar("--chart-price-tag-text", "#ffffff"),
    overlaySurface: readVar("--chart-overlay-surface", "rgba(255,255,255,0.86)"),
    overlayText: readVar("--chart-overlay-text", "#344257"),
  };
}

function createChartOptions(container, palette, watermarkText) {
  const bounds = container.getBoundingClientRect();

  return {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
    layout: {
      background: { type: ColorType.Solid, color: palette.stageBackground },
      textColor: palette.axisLabelColor,
      fontFamily: "Pretendard, SUIT Variable, Noto Sans KR, sans-serif",
      fontSize: 12,
    },
    grid: {
      vertLines: {
        color: palette.gridColor,
        style: LineStyle.Solid,
      },
      horzLines: {
        color: palette.gridColor,
        style: LineStyle.Solid,
      },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: "#cfd6e0",
        width: 1,
        style: LineStyle.SparseDotted,
        labelBackgroundColor: palette.stageBackground,
      },
      horzLine: {
        color: "#cfd6e0",
        width: 1,
        style: LineStyle.SparseDotted,
        labelBackgroundColor: palette.stageBackground,
      },
    },
    rightPriceScale: {
      borderColor: palette.stageLineColor,
      scaleMargins: {
        top: 0.08,
        bottom: 0.24,
      },
      autoScale: true,
    },
    timeScale: {
      borderColor: palette.stageLineColor,
      rightOffset: 6,
      barSpacing: DEFAULT_BAR_SPACING,
      minBarSpacing: MIN_BAR_SPACING,
      timeVisible: true,
      secondsVisible: false,
      fixLeftEdge: false,
      fixRightEdge: false,
      tickMarkFormatter: (time) =>
        formatSeoulTime(time, {
          fallback: "--:--",
        }),
    },
    localization: {
      locale: "ko-KR",
      priceFormatter: (price) => formatPrice(price),
      timeFormatter: (time) =>
        formatSeoulDateTime(time, {
          suffix: true,
          fallback: "--",
        }),
    },
    handleScroll: {
      mouseWheel: false,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      mouseWheel: false,
      pinch: false,
      axisPressedMouseMove: false,
      axisDoubleClickReset: false,
    },
    watermark: {
      visible: true,
      text: watermarkText,
      color: "rgba(120, 132, 154, 0.08)",
      fontSize: 44,
      horzAlign: "center",
      vertAlign: "center",
    },
  };
}

export function createLightweightChartRenderer(
  container,
  panel,
  { overlayElement = null } = {},
) {
  let palette = readThemePalette(container);
  const chart = createChart(
    container,
    createChartOptions(container, palette, `${panel.symbol} ${panel.timeframe.toUpperCase()}`),
  );

  const candleSeries = chart.addCandlestickSeries({
    upColor: palette.upColor,
    downColor: palette.downColor,
    borderVisible: false,
    wickUpColor: palette.upColor,
    wickDownColor: palette.downColor,
    priceLineVisible: true,
    lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
    priceLineSource: 0,
    priceFormat: {
      type: "price",
      precision: 2,
      minMove: 0.01,
    },
  });

  const volumeSeries = chart.addHistogramSeries({
    priceScaleId: "",
    priceFormat: {
      type: "volume",
    },
    priceLineVisible: false,
    lastValueVisible: false,
    base: 0,
  });

  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.82,
      bottom: 0,
    },
  });

  const indicatorSeries = INDICATOR_LINES.map((indicator) => (
    chart.addLineSeries({
      color: indicator.color,
      lineWidth: indicator.lineWidth,
      lineStyle: LineStyle.Solid,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    })
  ));

  let currentCandles = [];
  let currentBarSpacing = DEFAULT_BAR_SPACING;
  let hasInitialFit = false;
  let tradeMarkers = [];
  let positionPriceLine = null;

  const updateOverlay = (label) => {
    if (!overlayElement) {
      return;
    }

    const hasLabel = Boolean(label);
    overlayElement.hidden = !hasLabel;
    overlayElement.textContent = hasLabel ? label : "";
  };

  const syncPriceLineColor = () => {
    const lastCandle = currentCandles.at(-1) ?? null;
    const previousCandle = currentCandles.at(-2) ?? null;
    const direction = resolveDirection(lastCandle, previousCandle);
    const lineColor = direction === "down" ? palette.downColor : palette.upColor;

    candleSeries.applyOptions({
      priceLineColor: lineColor,
      lastValueVisible: true,
    });
  };

  const syncSeriesData = ({ scrollToRealtime = false } = {}) => {
    const normalizedCandles = normalizeCandles(currentCandles);

    if (normalizedCandles.length === 0) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      indicatorSeries.forEach((series) => series.setData([]));
      return;
    }

    candleSeries.setData(
      normalizedCandles.map((candle) => ({
        time: Math.floor(candle.openTime / 1000),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    volumeSeries.setData(
      normalizedCandles.map((candle, index) => {
        const previousCandle = normalizedCandles[index - 1] ?? null;
        const direction = resolveDirection(candle, previousCandle);

        return {
          time: Math.floor(candle.openTime / 1000),
          value: candle.volume,
          color: direction === "down" ? `${palette.downColor}55` : `${palette.upColor}66`,
        };
      }),
    );

    INDICATOR_LINES.forEach((indicator, index) => {
      indicatorSeries[index].setData(
        calculateEmaSeries(normalizedCandles, indicator.period),
      );
    });

    chart.timeScale().applyOptions({
      barSpacing: currentBarSpacing,
    });

    if (!hasInitialFit) {
      chart.timeScale().fitContent();
      hasInitialFit = true;
    } else if (scrollToRealtime) {
      chart.timeScale().scrollToRealTime();
    }

    syncPriceLineColor();
  };

  const applyTheme = () => {
    palette = readThemePalette(container);

    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: palette.stageBackground },
        textColor: palette.axisLabelColor,
      },
      grid: {
        vertLines: { color: palette.gridColor },
        horzLines: { color: palette.gridColor },
      },
      rightPriceScale: {
        borderColor: palette.stageLineColor,
      },
      timeScale: {
        borderColor: palette.stageLineColor,
      },
      watermark: {
        color: "rgba(120, 132, 154, 0.08)",
      },
    });

    candleSeries.applyOptions({
      upColor: palette.upColor,
      downColor: palette.downColor,
      wickUpColor: palette.upColor,
      wickDownColor: palette.downColor,
    });

    if (positionPriceLine) {
      positionPriceLine.applyOptions({
        color: palette.upColor,
        axisLabelColor: palette.upColor,
        lineColor: palette.upColor,
      });
    }

    syncSeriesData();
  };

  return {
    setData({
      candles = [],
      nextOverlayLabel = "",
      isStreaming = false,
    } = {}) {
      currentCandles = Array.isArray(candles) ? candles : [];
      updateOverlay(nextOverlayLabel);
      syncSeriesData({
        scrollToRealtime: isStreaming,
      });
      candleSeries.setMarkers(tradeMarkers);
    },

    resize() {
      const bounds = container.getBoundingClientRect();

      chart.applyOptions({
        width: Math.max(1, Math.round(bounds.width)),
        height: Math.max(1, Math.round(bounds.height)),
      });
    },

    zoomIn() {
      const nextBarSpacing = clamp(
        currentBarSpacing * ZOOM_STEP,
        MIN_BAR_SPACING,
        MAX_BAR_SPACING,
      );

      if (nextBarSpacing === currentBarSpacing) {
        return false;
      }

      currentBarSpacing = nextBarSpacing;
      chart.timeScale().applyOptions({ barSpacing: currentBarSpacing });
      return true;
    },

    zoomOut() {
      const nextBarSpacing = clamp(
        currentBarSpacing / ZOOM_STEP,
        MIN_BAR_SPACING,
        MAX_BAR_SPACING,
      );

      if (nextBarSpacing === currentBarSpacing) {
        return false;
      }

      currentBarSpacing = nextBarSpacing;
      chart.timeScale().applyOptions({ barSpacing: currentBarSpacing });
      return true;
    },

    resetZoom() {
      if (currentBarSpacing === DEFAULT_BAR_SPACING) {
        chart.timeScale().fitContent();
        return false;
      }

      currentBarSpacing = DEFAULT_BAR_SPACING;
      chart.timeScale().applyOptions({ barSpacing: currentBarSpacing });
      chart.timeScale().fitContent();
      return true;
    },

    getZoomState() {
      const width = Math.max(1, Math.round(container.clientWidth || 1));
      const estimatedVisibleCount = Math.max(
        1,
        Math.round(width / Math.max(MIN_BAR_SPACING, currentBarSpacing)),
      );

      return {
        visibleCount: Math.min(currentCandles.length || estimatedVisibleCount, estimatedVisibleCount),
        maxVisibleCount: Math.max(currentCandles.length, estimatedVisibleCount),
        canZoomIn: currentBarSpacing < MAX_BAR_SPACING,
        canZoomOut: currentBarSpacing > MIN_BAR_SPACING,
      };
    },

    refresh() {
      applyTheme();
      this.resize();
    },

    setTradeAnnotations({
      markers = [],
      averageEntryPrice = null,
    } = {}) {
      tradeMarkers = Array.isArray(markers) ? markers : [];
      candleSeries.setMarkers(tradeMarkers);

      if (Number.isFinite(averageEntryPrice) && averageEntryPrice > 0) {
        if (!positionPriceLine) {
          positionPriceLine = candleSeries.createPriceLine({
            price: averageEntryPrice,
            title: "평단",
            color: palette.upColor,
            lineColor: palette.upColor,
            lineStyle: LineStyle.Dashed,
            lineWidth: 1,
            axisLabelVisible: true,
            axisLabelColor: palette.upColor,
            axisLabelTextColor: palette.priceTagText,
          });
        } else {
          positionPriceLine.applyOptions({
            price: averageEntryPrice,
            color: palette.upColor,
            lineColor: palette.upColor,
            axisLabelColor: palette.upColor,
          });
        }
        return;
      }

      if (positionPriceLine) {
        candleSeries.removePriceLine(positionPriceLine);
        positionPriceLine = null;
      }
    },

    destroy() {
      if (positionPriceLine) {
        candleSeries.removePriceLine(positionPriceLine);
        positionPriceLine = null;
      }
      chart.remove();
    },

    formatPrice,
    formatCompactVolume,
    resolveDirection,
  };
}
