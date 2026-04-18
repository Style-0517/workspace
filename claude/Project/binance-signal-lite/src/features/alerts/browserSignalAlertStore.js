import { ALERT_HISTORY_STORAGE_KEY } from "../../config/localStateStorage.js";

export const DEFAULT_ALERT_HISTORY_LIMIT = 48;

function cloneAlert(alert) {
  return { ...alert };
}

function cloneState(state) {
  return {
    selectedAlertId: state.selectedAlertId,
    items: state.items.map(cloneAlert),
  };
}

function createInitialState() {
  return {
    selectedAlertId: null,
    items: [],
  };
}

function parseStoredState(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(rawValue);
    const items = Array.isArray(parsed?.items)
      ? parsed.items
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: String(item.id),
            fingerprint: String(item.fingerprint),
            formulaId: String(item.formulaId),
            formulaName: String(item.formulaName),
            symbol: String(item.symbol),
            timeframe: String(item.timeframe),
            signalType: String(item.signalType ?? ""),
            explanation: String(item.explanation ?? ""),
            detectedAt: String(item.detectedAt),
            detectedCandleOpenTime: Number(item.detectedCandleOpenTime ?? 0),
            entryPrice:
              item.entryPrice == null ? null : Number(item.entryPrice),
            stopLoss: item.stopLoss == null ? null : Number(item.stopLoss),
            takeProfit:
              item.takeProfit == null ? null : Number(item.takeProfit),
            confidence:
              item.confidence == null ? null : Number(item.confidence),
            status: item.status === "acknowledged" ? "acknowledged" : "new",
          }))
      : [];

    return {
      selectedAlertId:
        typeof parsed?.selectedAlertId === "string" ? parsed.selectedAlertId : null,
      items,
    };
  } catch {
    return createInitialState();
  }
}

function persistState(storage, storageKey, state) {
  if (typeof storage?.setItem !== "function") {
    return false;
  }

  storage.setItem(storageKey, JSON.stringify(state));
  return true;
}

function buildFingerprint({
  formulaId,
  symbol,
  timeframe,
  detectedCandleOpenTime,
}) {
  return [formulaId, symbol, timeframe, detectedCandleOpenTime].join(":");
}

function createAlertRecord(input) {
  const detectedCandleOpenTime = Number(input.detectedCandleOpenTime ?? 0);
  const fingerprint = buildFingerprint({
    formulaId: input.formulaId,
    symbol: input.symbol,
    timeframe: input.timeframe,
    detectedCandleOpenTime,
  });

  return {
    id: `alert:${fingerprint}`,
    fingerprint,
    formulaId: String(input.formulaId),
    formulaName: String(input.formulaName),
    symbol: String(input.symbol),
    timeframe: String(input.timeframe),
    signalType: String(input.signalType ?? ""),
    explanation: String(input.explanation ?? ""),
    detectedAt: String(input.detectedAt ?? new Date().toISOString()),
    detectedCandleOpenTime,
    entryPrice: input.entryPrice == null ? null : Number(input.entryPrice),
    stopLoss: input.stopLoss == null ? null : Number(input.stopLoss),
    takeProfit: input.takeProfit == null ? null : Number(input.takeProfit),
    confidence: input.confidence == null ? null : Number(input.confidence),
    status: "new",
  };
}

export function createBrowserSignalAlertStore({
  storage = null,
  storageKey = ALERT_HISTORY_STORAGE_KEY,
  maxItems = DEFAULT_ALERT_HISTORY_LIMIT,
} = {}) {
  const listeners = new Set();
  let state = parseStoredState(
    typeof storage?.getItem === "function" ? storage.getItem(storageKey) : null,
  );

  const emit = () => {
    const snapshot = cloneState(state);
    listeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const commit = (nextState) => {
    state = nextState;
    persistState(storage, storageKey, state);
    emit();
  };

  return {
    subscribe(listener, { emitCurrent = true } = {}) {
      listeners.add(listener);

      if (emitCurrent) {
        listener(cloneState(state));
      }

      return () => {
        listeners.delete(listener);
      };
    },

    getState() {
      return cloneState(state);
    },

    getSelectedAlert() {
      return state.items.find((item) => item.id === state.selectedAlertId) ?? null;
    },

    recordMatch(input) {
      const nextAlert = createAlertRecord(input);
      const existingAlert = state.items.find(
        (item) => item.fingerprint === nextAlert.fingerprint,
      );

      if (existingAlert) {
        return cloneAlert(existingAlert);
      }

      commit({
        selectedAlertId: state.selectedAlertId,
        items: [nextAlert, ...state.items].slice(0, maxItems),
      });

      return cloneAlert(nextAlert);
    },

    acknowledge(alertId) {
      const hasTarget = state.items.some((item) => item.id === alertId);

      if (!hasTarget) {
        return false;
      }

      commit({
        ...state,
        items: state.items.map((item) =>
          item.id === alertId ? { ...item, status: "acknowledged" } : item,
        ),
      });

      return true;
    },

    selectAlert(alertId) {
      const hasTarget = state.items.some((item) => item.id === alertId);

      if (!hasTarget) {
        return false;
      }

      commit({
        ...state,
        selectedAlertId: alertId,
      });

      return true;
    },

    clear() {
      commit(createInitialState());
    },
  };
}
