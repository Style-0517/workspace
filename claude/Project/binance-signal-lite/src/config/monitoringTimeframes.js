import { SUPPORTED_INTERVALS } from "./binanceStreams.js";

export const MONITORING_TIMEFRAMES = Object.freeze(
  SUPPORTED_INTERVALS.filter((interval) => interval === "1m" || interval === "5m"),
);
export const DEFAULT_ACTIVE_TIMEFRAME = "1m";
export const ACTIVE_TIMEFRAME_QUERY_PARAM = "timeframe";
export const ACTIVE_TIMEFRAME_STORAGE_KEY =
  "binance-signal-lite.monitoring.active-timeframe";

const TIMEFRAME_LABELS = Object.freeze({
  "1m": "1분봉",
  "3m": "3분봉",
  "5m": "5분봉",
  "15m": "15분봉",
});

function normalizeTimeframe(timeframe) {
  if (typeof timeframe !== "string") {
    return null;
  }

  const normalizedTimeframe = timeframe.trim().toLowerCase();

  if (!MONITORING_TIMEFRAMES.includes(normalizedTimeframe)) {
    return null;
  }

  return normalizedTimeframe;
}

function readTimeframeFromLocation(windowRef) {
  const href = windowRef?.location?.href;

  if (typeof href !== "string" || href.length === 0) {
    return null;
  }

  return new URL(href, "https://binance-signal-lite.local")
    .searchParams
    .get(ACTIVE_TIMEFRAME_QUERY_PARAM);
}

export function isMonitoringTimeframeSupported(timeframe) {
  return normalizeTimeframe(timeframe) !== null;
}

export function normalizeMonitoringTimeframe(timeframe) {
  return normalizeTimeframe(timeframe) ?? DEFAULT_ACTIVE_TIMEFRAME;
}

export function getMonitoringTimeframeLabel(timeframe) {
  if (typeof timeframe !== "string") {
    return String(timeframe ?? "");
  }

  const normalizedTimeframe = timeframe.trim().toLowerCase();

  return TIMEFRAME_LABELS[normalizedTimeframe] ?? String(timeframe ?? "");
}

export function getMonitoringTimeframeOptions() {
  return MONITORING_TIMEFRAMES.map((value) => ({
    value,
    label: getMonitoringTimeframeLabel(value),
  }));
}

export function resolveConfiguredActiveTimeframe({
  initialTimeframe = null,
  windowRef = globalThis,
  storage = null,
} = {}) {
  const storageTimeframe =
    typeof storage?.getItem === "function"
      ? storage.getItem(ACTIVE_TIMEFRAME_STORAGE_KEY)
      : null;

  return (
    normalizeTimeframe(initialTimeframe)
    ?? normalizeTimeframe(readTimeframeFromLocation(windowRef))
    ?? normalizeTimeframe(storageTimeframe)
    ?? DEFAULT_ACTIVE_TIMEFRAME
  );
}

export function persistConfiguredActiveTimeframe(storage, timeframe) {
  if (typeof storage?.setItem !== "function") {
    return false;
  }

  const normalizedTimeframe = normalizeTimeframe(timeframe);

  if (!normalizedTimeframe) {
    return false;
  }

  storage.setItem(ACTIVE_TIMEFRAME_STORAGE_KEY, normalizedTimeframe);
  return true;
}
