import { formatSeoulTime } from "./seoulTime.js";

const UP_CANDLE_COLOR = "#e04f5f";
const DOWN_CANDLE_COLOR = "#2f6bff";
const NEUTRAL_TEXT_COLOR = "#6b778c";
const GRID_COLOR = "#e8eef5";
const STAGE_BACKGROUND = "#ffffff";
const STAGE_LINE_COLOR = "#d8e1ec";
const WATERMARK_COLOR = "rgba(13, 24, 40, 0.05)";
const AXIS_LABEL_COLOR = "#738199";
const PRICE_TAG_TEXT_COLOR = "#ffffff";
const INDICATOR_LINES = Object.freeze([
  { period: 7, color: "#f59e0b", lineWidth: 1.4 },
  { period: 20, color: "#8b5cf6", lineWidth: 1.2 },
  { period: 60, color: "#94a3b8", lineWidth: 1.2 },
]);

const INTERVAL_MS = Object.freeze({
  "1m": 60 * 1000,
  "3m": 3 * 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
});

const DEFAULT_VISIBLE_CANDLES = 36;
const MIN_VISIBLE_CANDLES = 12;
const ZOOM_STEP = 6;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function easeOutCubic(progress) {
  return 1 - ((1 - progress) ** 3);
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function resolveDpr(canvas) {
  return canvas.ownerDocument?.defaultView?.devicePixelRatio ?? 1;
}

function resizeCanvas(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const dpr = resolveDpr(canvas);
  const width = Math.max(1, Math.round(bounds.width * dpr));
  const height = Math.max(1, Math.round(bounds.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return {
    width: bounds.width,
    height: bounds.height,
    dpr,
  };
}

function resolveIntervalMs(timeframe) {
  return INTERVAL_MS[timeframe] ?? INTERVAL_MS["1m"];
}

function parseNumeric(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
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

function formatTime(openTime) {
  return formatSeoulTime(openTime, {
    fallback: "--:--",
  });
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

function normalizeCandle(candle, index, timeframe, previousOpenTime = null) {
  const intervalMs = resolveIntervalMs(timeframe);
  const resolvedOpenTime = Number.isFinite(Number(candle?.openTime))
    ? Number(candle.openTime)
    : (
        Number.isFinite(previousOpenTime)
          ? previousOpenTime + intervalMs
          : index * intervalMs
      );
  const open = parseNumeric(candle?.open);
  const close = parseNumeric(candle?.close, open);
  const high = parseNumeric(candle?.high, Math.max(open, close));
  const low = parseNumeric(candle?.low, Math.min(open, close));
  const volume = parseNumeric(
    candle?.volume,
    Math.max(1, Math.abs(close - open) * 12),
  );

  return {
    openTime: resolvedOpenTime,
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
    volume,
    closeTime: parseNumeric(candle?.closeTime, resolvedOpenTime + intervalMs - 1),
    isClosed: Boolean(candle?.isClosed),
  };
}

function normalizeCandles(candles, timeframe) {
  let previousOpenTime = null;

  return candles.map((candle, index) => {
    const normalized = normalizeCandle(candle, index, timeframe, previousOpenTime);
    previousOpenTime = normalized.openTime;
    return normalized;
  });
}

function clampVisibleCount(visibleCount, maxVisibleCount) {
  return clamp(
    Math.round(visibleCount),
    MIN_VISIBLE_CANDLES,
    Math.max(MIN_VISIBLE_CANDLES, maxVisibleCount),
  );
}

function getVisibleCandles(candles, visibleCount) {
  if (candles.length === 0) {
    return candles;
  }

  const nextVisibleCount = clampVisibleCount(visibleCount, candles.length);
  return candles.slice(-nextVisibleCount);
}

function buildFallbackSource(target, previousSource, timeframe) {
  const fallbackPrice = previousSource?.close ?? target.open ?? target.close;
  const intervalMs = resolveIntervalMs(timeframe);

  return {
    openTime: target.openTime - intervalMs,
    open: fallbackPrice,
    high: fallbackPrice,
    low: fallbackPrice,
    close: fallbackPrice,
    volume: previousSource?.volume ?? 0,
    closeTime: target.closeTime - intervalMs,
    isClosed: false,
  };
}

function interpolateCandles(fromCandles, toCandles, timeframe, progress) {
  if (progress >= 1 || fromCandles.length === 0) {
    return toCandles.map((candle) => ({ ...candle }));
  }

  const fromByOpenTime = new Map(
    fromCandles.map((candle) => [candle.openTime, candle]),
  );

  return toCandles.map((targetCandle, index) => {
    const sourceCandle =
      fromByOpenTime.get(targetCandle.openTime)
      ?? buildFallbackSource(targetCandle, fromCandles.at(-1), timeframe);

    return {
      ...targetCandle,
      open: lerp(sourceCandle.open, targetCandle.open, progress),
      high: lerp(sourceCandle.high, targetCandle.high, progress),
      low: lerp(sourceCandle.low, targetCandle.low, progress),
      close: lerp(sourceCandle.close, targetCandle.close, progress),
      volume: lerp(sourceCandle.volume, targetCandle.volume, progress),
      openTime:
        index === 0
          ? targetCandle.openTime
          : lerp(sourceCandle.openTime, targetCandle.openTime, progress),
    };
  });
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

function resolveTrendColor(direction) {
  if (direction === "up") {
    return UP_CANDLE_COLOR;
  }

  if (direction === "down") {
    return DOWN_CANDLE_COLOR;
  }

  return NEUTRAL_TEXT_COLOR;
}

function readThemePalette(canvas) {
  const styleTarget = canvas.closest(".phone-shell") ?? canvas.ownerDocument?.documentElement;
  const styles = styleTarget ? getComputedStyle(styleTarget) : null;
  const readVar = (name, fallback) => styles?.getPropertyValue(name)?.trim() || fallback;

  return {
    upColor: readVar("--chart-up", UP_CANDLE_COLOR),
    downColor: readVar("--chart-down", DOWN_CANDLE_COLOR),
    neutralText: readVar("--chart-neutral", NEUTRAL_TEXT_COLOR),
    gridColor: readVar("--chart-grid", GRID_COLOR),
    stageBackground: readVar("--chart-stage-background", STAGE_BACKGROUND),
    stageLineColor: readVar("--chart-stage-line", STAGE_LINE_COLOR),
    watermarkColor: readVar("--chart-watermark", WATERMARK_COLOR),
    axisLabelColor: readVar("--chart-axis-text", AXIS_LABEL_COLOR),
    priceTagText: readVar("--chart-price-tag-text", PRICE_TAG_TEXT_COLOR),
    overlaySurface: readVar("--chart-overlay-surface", "rgba(255, 255, 255, 0.82)"),
    overlayText: readVar("--chart-overlay-text", "#344257"),
  };
}

function resolvePaletteTrendColor(direction, palette) {
  if (direction === "up") {
    return palette.upColor;
  }

  if (direction === "down") {
    return palette.downColor;
  }

  return palette.neutralText;
}

function drawWatermark(context, plotBounds, symbol, timeframe, palette) {
  context.save();
  context.fillStyle = palette.watermarkColor;
  context.font = "700 30px 'Pretendard', 'SUIT Variable', 'Noto Sans KR', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    `${symbol} ${timeframe.toUpperCase()}`,
    plotBounds.left + plotBounds.width / 2,
    plotBounds.top + plotBounds.height / 2,
  );
  context.restore();
}

function drawGrid(context, plotBounds, volumeBounds, palette) {
  context.save();
  context.strokeStyle = palette.gridColor;
  context.lineWidth = 1;

  for (let index = 0; index <= 4; index += 1) {
    const y = plotBounds.top + (plotBounds.height / 4) * index;
    context.beginPath();
    context.moveTo(plotBounds.left, y);
    context.lineTo(plotBounds.right, y);
    context.stroke();
  }

  for (let index = 0; index <= 5; index += 1) {
    const x = plotBounds.left + (plotBounds.width / 5) * index;
    context.beginPath();
    context.moveTo(x, plotBounds.top);
    context.lineTo(x, volumeBounds.bottom);
    context.stroke();
  }

  context.strokeStyle = palette.stageLineColor;
  context.beginPath();
  context.moveTo(plotBounds.right, plotBounds.top);
  context.lineTo(plotBounds.right, volumeBounds.bottom);
  context.stroke();

  context.restore();
}

function drawAxisLabels(context, plotBounds, volumeBounds, candles, priceRange, palette) {
  if (candles.length === 0) {
    return;
  }

  context.save();
  context.fillStyle = palette.axisLabelColor;
  context.font = "500 11px 'Pretendard', 'SUIT Variable', 'Noto Sans KR', sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";

  for (let index = 0; index <= 4; index += 1) {
    const value = lerp(priceRange.max, priceRange.min, index / 4);
    const y = plotBounds.top + (plotBounds.height / 4) * index;
    context.fillText(formatPrice(value), plotBounds.right + 10, y);
  }

  context.textBaseline = "top";

  for (let index = 0; index <= 3; index += 1) {
    const candleIndex = Math.min(
      candles.length - 1,
      Math.round((candles.length - 1) * (index / 3)),
    );
    const candle = candles[candleIndex];
    const x = plotBounds.left + (plotBounds.width / 3) * index;
    context.fillText(formatTime(candle?.openTime), x - 14, volumeBounds.bottom + 8);
  }

  context.restore();
}

function drawVolumeBars(context, candles, plotBounds, volumeBounds, palette) {
  if (candles.length === 0) {
    return;
  }

  const maxVolume = Math.max(...candles.map((candle) => candle.volume), 1);
  const stepX = plotBounds.width / candles.length;
  const barWidth = Math.max(3, Math.min(12, stepX * 0.56));

  candles.forEach((candle, index) => {
    const volumeRatio = candle.volume / maxVolume;
    const barHeight = Math.max(2, volumeBounds.height * volumeRatio);
    const x = plotBounds.left + stepX * index + stepX / 2;
    const y = volumeBounds.bottom - barHeight;
    const direction = resolveDirection(candle);

    context.fillStyle = direction === "up"
      ? `${palette.upColor}3d`
      : `${palette.downColor}33`;
    context.fillRect(x - barWidth / 2, y, barWidth, barHeight);
  });

  context.save();
  context.fillStyle = palette.axisLabelColor;
  context.font = "500 11px 'Pretendard', 'SUIT Variable', 'Noto Sans KR', sans-serif";
  context.textAlign = "left";
  context.textBaseline = "bottom";
  context.fillText("VOL", plotBounds.left, volumeBounds.top - 4);
  context.fillText(
    formatCompactVolume(candles.at(-1)?.volume ?? 0),
    plotBounds.right - 32,
    volumeBounds.top - 4,
  );
  context.restore();
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
      openTime: candle.openTime,
      value: ema,
    };
  });
}

function drawIndicatorLines(context, candles, plotBounds, priceRange) {
  if (candles.length < 2) {
    return;
  }

  const stepX = plotBounds.width / candles.length;
  const scaleY = (value) => (
    plotBounds.top
    + ((priceRange.max - value) / priceRange.range) * plotBounds.height
  );

  INDICATOR_LINES.forEach((indicator) => {
    const series = calculateEmaSeries(candles, indicator.period);

    context.save();
    context.strokeStyle = indicator.color;
    context.lineWidth = indicator.lineWidth;
    context.beginPath();

    series.forEach((point, index) => {
      const x = plotBounds.left + stepX * index + stepX / 2;
      const y = scaleY(point.value);

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.stroke();
    context.restore();
  });
}

function drawCandles(context, candles, plotBounds, priceRange, palette) {
  if (candles.length === 0) {
    return;
  }

  const stepX = plotBounds.width / candles.length;
  const bodyWidth = Math.max(4, Math.min(12, stepX * 0.58));
  const scaleY = (value) => (
    plotBounds.top
    + ((priceRange.max - value) / priceRange.range) * plotBounds.height
  );

  candles.forEach((candle, index) => {
    const x = plotBounds.left + stepX * index + stepX / 2;
    const openY = scaleY(candle.open);
    const closeY = scaleY(candle.close);
    const highY = scaleY(candle.high);
    const lowY = scaleY(candle.low);
    const direction = resolveDirection(candle);
    const color = resolvePaletteTrendColor(direction, palette);

    context.strokeStyle = color;
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(x, highY);
    context.lineTo(x, lowY);
    context.stroke();

    context.fillStyle = color;
    context.fillRect(
      x - bodyWidth / 2,
      Math.min(openY, closeY),
      bodyWidth,
      Math.max(2, Math.abs(closeY - openY)),
    );
  });

  return scaleY;
}

function drawCurrentPriceLine(context, candles, plotBounds, scaleY, pulseTime, palette) {
  const lastCandle = candles.at(-1);
  const previousCandle = candles.at(-2) ?? null;

  if (!lastCandle || !scaleY) {
    return;
  }

  const direction = resolveDirection(lastCandle, previousCandle);
  const lineColor = resolvePaletteTrendColor(direction, palette);
  const y = scaleY(lastCandle.close);
  const pulseAlpha = 0.16 + ((Math.sin(pulseTime / 280) + 1) / 2) * 0.26;
  const stepX = plotBounds.width / candles.length;
  const x = plotBounds.left + stepX * (candles.length - 1) + stepX / 2;

  context.save();
  context.strokeStyle = `${lineColor}66`;
  context.setLineDash([5, 4]);
  context.beginPath();
  context.moveTo(plotBounds.left, y);
  context.lineTo(plotBounds.right, y);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = `${lineColor}${Math.round(pulseAlpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
  context.beginPath();
  context.arc(x, y, 7, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = lineColor;
  context.fillRect(plotBounds.right + 8, y - 12, 52, 24);
  context.fillStyle = palette.priceTagText;
  context.font = "600 11px 'Pretendard', 'SUIT Variable', 'Noto Sans KR', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(formatPrice(lastCandle.close), plotBounds.right + 34, y);
  context.restore();
}

function drawOverlayLabel(context, width, height, label, palette) {
  if (!label) {
    return;
  }

  context.save();
  context.fillStyle = palette.overlaySurface;
  context.fillRect((width / 2) - 140, (height / 2) - 22, 280, 44);
  context.fillStyle = palette.overlayText;
  context.font = "600 13px 'Pretendard', 'SUIT Variable', 'Noto Sans KR', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, width / 2, height / 2);
  context.restore();
}

function createPriceRange(candles) {
  const high = Math.max(...candles.map((candle) => candle.high));
  const low = Math.min(...candles.map((candle) => candle.low));
  const range = Math.max(1, high - low);
  const padding = range * 0.14;

  return {
    max: high + padding,
    min: Math.max(0, low - padding),
    range: Math.max(1, range + padding * 2),
  };
}

function normalizePriceRange(range) {
  if (!range) {
    return null;
  }

  const nextRange = Math.max(1, range.max - range.min);

  return {
    max: range.max,
    min: range.min,
    range: nextRange,
  };
}

function resolveStablePriceRange(currentRange, targetRange) {
  if (!targetRange) {
    return currentRange ?? null;
  }

  if (!currentRange) {
    return normalizePriceRange(targetRange);
  }

  const currentSpan = Math.max(1, currentRange.max - currentRange.min);
  const margin = currentSpan * 0.08;
  const shouldExpandTop = targetRange.max > currentRange.max - margin;
  const shouldExpandBottom = targetRange.min < currentRange.min + margin;

  if (!shouldExpandTop && !shouldExpandBottom) {
    return currentRange;
  }

  return normalizePriceRange({
    max: shouldExpandTop ? targetRange.max : currentRange.max,
    min: shouldExpandBottom ? targetRange.min : currentRange.min,
  });
}

function createStageBounds(width, height) {
  const axisWidth = 66;
  const volumeHeight = Math.min(74, Math.max(54, height * 0.18));
  const plotTop = 16;
  const plotLeft = 14;
  const plotRight = width - axisWidth;
  const plotBottom = height - volumeHeight - 28;

  return {
    plot: {
      left: plotLeft,
      top: plotTop,
      right: plotRight,
      bottom: plotBottom,
      width: plotRight - plotLeft,
      height: plotBottom - plotTop,
    },
    volume: {
      left: plotLeft,
      top: plotBottom + 10,
      right: plotRight,
      bottom: height - 28,
      width: plotRight - plotLeft,
      height: height - 28 - (plotBottom + 10),
    },
  };
}

function drawChartFrame(
  canvas,
  {
    candles,
    rangeCandles = candles,
    priceRangeOverride = null,
    overlayLabel,
    symbol,
    timeframe,
    streaming,
    pulseTime,
  },
) {
  const { width, height, dpr } = resizeCanvas(canvas);
  const context = canvas.getContext("2d");
  const palette = readThemePalette(canvas);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(dpr, dpr);

  context.fillStyle = palette.stageBackground;
  context.fillRect(0, 0, width, height);

  const normalizedCandles = normalizeCandles(candles, timeframe);
  const normalizedRangeCandles = normalizeCandles(rangeCandles, timeframe);
  const bounds = createStageBounds(width, height);

  drawGrid(context, bounds.plot, bounds.volume, palette);
  drawWatermark(context, bounds.plot, symbol, timeframe, palette);

  if (normalizedCandles.length === 0) {
    drawOverlayLabel(context, width, height, overlayLabel, palette);
    return;
  }

  const priceRange = priceRangeOverride ?? createPriceRange(
    normalizedRangeCandles.length > 0 ? normalizedRangeCandles : normalizedCandles,
  );
  drawAxisLabels(
    context,
    bounds.plot,
    bounds.volume,
    normalizedCandles,
    priceRange,
    palette,
  );
  drawVolumeBars(context, normalizedCandles, bounds.plot, bounds.volume, palette);
  drawIndicatorLines(context, normalizedCandles, bounds.plot, priceRange);
  const scaleY = drawCandles(context, normalizedCandles, bounds.plot, priceRange, palette);
  drawCurrentPriceLine(
    context,
    normalizedCandles,
    bounds.plot,
    scaleY,
    streaming ? pulseTime : 0,
    palette,
  );

  if (overlayLabel && normalizedCandles.length === 0) {
    drawOverlayLabel(context, width, height, overlayLabel, palette);
  }
}

export function createCandleChartRenderer(canvas, panel) {
  let fromCandles = [];
  let toCandles = [];
  let overlayLabel = "";
  let streaming = false;
  let animationStartedAt = 0;
  let animationFrameId = 0;
  let transitionDurationMs = 220;
  let visibleCount = DEFAULT_VISIBLE_CANDLES;
  let maxVisibleCount = DEFAULT_VISIBLE_CANDLES;
  let stablePriceRange = null;

  const render = (timestamp = now()) => {
    animationFrameId = 0;
    const progress = clamp(
      transitionDurationMs === 0
        ? 1
        : (timestamp - animationStartedAt) / transitionDurationMs,
      0,
      1,
    );
    const resolvedCandles = interpolateCandles(
      fromCandles,
      toCandles,
      panel.timeframe,
      easeOutCubic(progress),
    );
    const priceRangeReferenceCandles = getVisibleCandles(
      resolvedCandles,
      clampVisibleCount(
        Math.max(DEFAULT_VISIBLE_CANDLES, visibleCount),
        maxVisibleCount,
      ),
    );
    const visibleCandles = getVisibleCandles(
      resolvedCandles,
      clampVisibleCount(visibleCount, maxVisibleCount),
    );

    const targetPriceRange = createPriceRange(
      priceRangeReferenceCandles.length > 0 ? priceRangeReferenceCandles : visibleCandles,
    );
    stablePriceRange = resolveStablePriceRange(stablePriceRange, targetPriceRange);

    drawChartFrame(canvas, {
      candles: visibleCandles,
      rangeCandles: priceRangeReferenceCandles,
      priceRangeOverride: stablePriceRange,
      overlayLabel,
      symbol: panel.symbol,
      timeframe: panel.timeframe,
      streaming,
      pulseTime: timestamp,
    });

    if (streaming || progress < 1) {
      animationFrameId = requestAnimationFrame(render);
    }
  };

  const scheduleRender = () => {
    if (animationFrameId) {
      return;
    }

    animationFrameId = requestAnimationFrame(render);
  };

  return {
    setData({
      candles = [],
      nextOverlayLabel = "",
      isStreaming = false,
      durationMs = 220,
    } = {}) {
      const timestamp = now();
      const currentCandles = interpolateCandles(
        fromCandles,
        toCandles,
        panel.timeframe,
        clamp(
          transitionDurationMs === 0
            ? 1
            : (timestamp - animationStartedAt) / transitionDurationMs,
          0,
          1,
        ),
      );

      fromCandles = normalizeCandles(currentCandles, panel.timeframe);
      toCandles = normalizeCandles(candles, panel.timeframe);
      maxVisibleCount = Math.max(MIN_VISIBLE_CANDLES, toCandles.length);
      visibleCount = clampVisibleCount(visibleCount, maxVisibleCount);
      stablePriceRange = null;
      overlayLabel = nextOverlayLabel;
      streaming = isStreaming;
      animationStartedAt = timestamp;
      transitionDurationMs = durationMs;
      scheduleRender();
    },

    resize() {
      scheduleRender();
    },

    zoomIn() {
      const nextVisibleCount = clampVisibleCount(
        visibleCount - ZOOM_STEP,
        maxVisibleCount,
      );

      if (nextVisibleCount === visibleCount) {
        return false;
      }

      visibleCount = nextVisibleCount;
      scheduleRender();
      return true;
    },

    zoomOut() {
      const nextVisibleCount = clampVisibleCount(
        visibleCount + ZOOM_STEP,
        maxVisibleCount,
      );

      if (nextVisibleCount === visibleCount) {
        return false;
      }

      visibleCount = nextVisibleCount;
      scheduleRender();
      return true;
    },

    getZoomState() {
      return {
        visibleCount: clampVisibleCount(visibleCount, maxVisibleCount),
        maxVisibleCount,
        canZoomIn: clampVisibleCount(visibleCount, maxVisibleCount) > MIN_VISIBLE_CANDLES,
        canZoomOut: clampVisibleCount(visibleCount, maxVisibleCount) < maxVisibleCount,
      };
    },

    resetZoom() {
      const nextVisibleCount = clampVisibleCount(DEFAULT_VISIBLE_CANDLES, maxVisibleCount);

      if (nextVisibleCount === visibleCount) {
        return false;
      }

      visibleCount = nextVisibleCount;
      scheduleRender();
      return true;
    },

    refresh() {
      scheduleRender();
    },

    destroy() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    },

    formatPrice,
    formatCompactVolume,
    resolveDirection,
  };
}
