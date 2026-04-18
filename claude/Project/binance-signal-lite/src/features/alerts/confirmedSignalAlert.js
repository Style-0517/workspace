import { deepFreeze } from "../../shared/deep-freeze.js";

export const ALERT_DEEP_LINK_SCHEME = "binance-signal-lite";
export const ALERT_DEEP_LINK_SCREEN = "signal-detail";
export const ALERT_NAVIGATION_PAYLOAD_VERSION = 1;
export const SUPPORTED_ALERT_TIMEFRAMES = Object.freeze(["1m", "3m", "5m", "15m"]);

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
}

function normalizeSymbol(symbol) {
  assertNonEmptyString(symbol, "symbol");

  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!/^[A-Z0-9]+USDT$/.test(normalizedSymbol)) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }

  return normalizedSymbol;
}

function normalizeTimeframe(timeframe) {
  assertNonEmptyString(timeframe, "timeframe");

  const normalizedTimeframe = timeframe.trim().toLowerCase();

  if (!SUPPORTED_ALERT_TIMEFRAMES.includes(normalizedTimeframe)) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }

  return normalizedTimeframe;
}

function normalizeOptionalString(value, fieldName) {
  if (value == null) {
    return null;
  }

  assertNonEmptyString(value, fieldName);
  return value.trim();
}

function normalizeOptionalPrice(value, fieldName) {
  if (value == null) {
    return null;
  }

  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }

  return normalizedValue;
}

function normalizeTradeLevels({ entryPrice, stopLoss, takeProfit }) {
  const normalizedEntryPrice = normalizeOptionalPrice(entryPrice, "entryPrice");
  const normalizedStopLoss = normalizeOptionalPrice(stopLoss, "stopLoss");
  const normalizedTakeProfit = normalizeOptionalPrice(takeProfit, "takeProfit");
  const providedFieldCount = [
    normalizedEntryPrice,
    normalizedStopLoss,
    normalizedTakeProfit,
  ].filter((value) => value != null).length;

  if (providedFieldCount === 0) {
    return {
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
    };
  }

  if (providedFieldCount !== 3) {
    throw new Error(
      "entryPrice, stopLoss, and takeProfit must be provided together",
    );
  }

  return {
    entryPrice: normalizedEntryPrice,
    stopLoss: normalizedStopLoss,
    takeProfit: normalizedTakeProfit,
  };
}

function normalizeConfirmedAt(confirmedAt) {
  if (confirmedAt == null) {
    return new Date().toISOString();
  }

  const date =
    confirmedAt instanceof Date ? confirmedAt : new Date(confirmedAt);

  if (Number.isNaN(date.getTime())) {
    throw new Error("confirmedAt must be a valid date value");
  }

  return date.toISOString();
}

function normalizeAlertContext({
  alertId,
  symbol,
  timeframe,
  formulaId = null,
}) {
  assertNonEmptyString(alertId, "alertId");

  return {
    alertId: alertId.trim(),
    symbol: normalizeSymbol(symbol),
    timeframe: normalizeTimeframe(timeframe),
    formulaId: normalizeOptionalString(formulaId, "formulaId"),
  };
}

function buildNavigationPayload(context) {
  return {
    version: ALERT_NAVIGATION_PAYLOAD_VERSION,
    screen: ALERT_DEEP_LINK_SCREEN,
    routeKey: `${context.symbol}:${context.timeframe}`,
    params: {
      alertId: context.alertId,
      symbol: context.symbol,
      timeframe: context.timeframe,
      formulaId: context.formulaId,
    },
  };
}

function buildDeepLink(payload) {
  const searchParams = new URLSearchParams({
    alertId: payload.params.alertId,
    symbol: payload.params.symbol,
    timeframe: payload.params.timeframe,
  });

  if (payload.params.formulaId) {
    searchParams.set("formulaId", payload.params.formulaId);
  }

  return `${ALERT_DEEP_LINK_SCHEME}://${payload.screen}?${searchParams.toString()}`;
}

export function createConfirmedSignalNavigationPayload(input) {
  return deepFreeze(buildNavigationPayload(normalizeAlertContext(input)));
}

export function createConfirmedSignalDeepLink(input) {
  return buildDeepLink(buildNavigationPayload(normalizeAlertContext(input)));
}

export function parseConfirmedSignalDeepLink(deepLink) {
  assertNonEmptyString(deepLink, "deepLink");

  const parsedUrl = new URL(deepLink);

  if (parsedUrl.protocol !== `${ALERT_DEEP_LINK_SCHEME}:`) {
    throw new Error(`Unsupported deep link scheme: ${parsedUrl.protocol}`);
  }

  if (parsedUrl.hostname !== ALERT_DEEP_LINK_SCREEN) {
    throw new Error(`Unsupported deep link screen: ${parsedUrl.hostname}`);
  }

  return createConfirmedSignalNavigationPayload({
    alertId: parsedUrl.searchParams.get("alertId"),
    symbol: parsedUrl.searchParams.get("symbol"),
    timeframe: parsedUrl.searchParams.get("timeframe"),
    formulaId: parsedUrl.searchParams.get("formulaId"),
  });
}

export function createConfirmedSignalAlert({
  alertId,
  symbol,
  timeframe,
  formulaId = null,
  signalType,
  direction = null,
  entryPrice = null,
  stopLoss = null,
  takeProfit = null,
  rationale = "",
  confirmedAt = null,
}) {
  const context = normalizeAlertContext({
    alertId,
    symbol,
    timeframe,
    formulaId,
  });
  const normalizedSignalType = normalizeOptionalString(signalType, "signalType");
  const normalizedDirection = normalizeOptionalString(direction, "direction");
  const tradeLevels = normalizeTradeLevels({
    entryPrice,
    stopLoss,
    takeProfit,
  });
  const navigation = buildNavigationPayload(context);

  return deepFreeze({
    id: context.alertId,
    kind: "confirmed-signal",
    status: "confirmed",
    symbol: context.symbol,
    timeframe: context.timeframe,
    signalType: normalizedSignalType,
    direction: normalizedDirection,
    entryPrice: tradeLevels.entryPrice,
    stopLoss: tradeLevels.stopLoss,
    takeProfit: tradeLevels.takeProfit,
    rationale: rationale == null ? "" : String(rationale).trim(),
    confirmedAt: normalizeConfirmedAt(confirmedAt),
    navigation: {
      ...navigation,
      deepLink: buildDeepLink(navigation),
    },
  });
}
