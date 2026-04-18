import {
  detectBollingerSqueezeBreakoutSignal,
  BOLLINGER_SQUEEZE_FORMULA_ID,
} from "./bollingerSqueezeBreakoutStrategy.js";
import {
  detectBoxRangeBreakoutSignal,
  BOX_RANGE_BREAKOUT_FORMULA_ID,
} from "./boxRangeBreakoutStrategy.js";
import {
  detectEmaPullbackTrendContinuationSignal,
  EMA_PULLBACK_FORMULA_ID,
} from "./emaPullbackTrendStrategy.js";
import { TRADING_FORMULAS } from "../trading-formulas/trading-formulas.js";

const DEFAULT_DETECTORS = Object.freeze({
  [EMA_PULLBACK_FORMULA_ID]: (candles) =>
    detectEmaPullbackTrendContinuationSignal(candles),
  [BOX_RANGE_BREAKOUT_FORMULA_ID]: (candles) =>
    detectBoxRangeBreakoutSignal(candles),
  [BOLLINGER_SQUEEZE_FORMULA_ID]: (candles) =>
    detectBollingerSqueezeBreakoutSignal(candles),
});

function getDetectedCandle(signal) {
  return signal?.confirmationCandle ?? signal?.breakoutCandle ?? null;
}

function createAlertPayload(formula, panel, signal, snapshot) {
  const detectedCandle = getDetectedCandle(signal);
  const detectedAtValue =
    detectedCandle?.closeTime ?? snapshot?.lastEventTime ?? Date.now();

  return {
    formulaId: formula.id,
    formulaName: formula.name,
    symbol: panel.symbol,
    timeframe: panel.timeframe,
    signalType: signal?.signalType ?? formula.detection.signalType,
    explanation: signal?.explanation ?? formula.description,
    detectedAt: new Date(detectedAtValue).toISOString(),
    detectedCandleOpenTime: detectedCandle?.openTime ?? detectedAtValue,
    entryPrice: signal?.entryPrice ?? null,
    stopLoss: signal?.stopLoss ?? null,
    takeProfit: signal?.takeProfit ?? null,
    confidence: signal?.confidence ?? null,
  };
}

export function createFormulaMatchMonitor({
  marketData,
  alertStore,
  formulas = TRADING_FORMULAS,
  detectors = DEFAULT_DETECTORS,
  onMatch = null,
} = {}) {
  if (!marketData || typeof marketData.subscribe !== "function") {
    throw new Error("marketData with subscribe() is required");
  }

  if (!alertStore || typeof alertStore.recordMatch !== "function") {
    throw new Error("alertStore with recordMatch() is required");
  }

  const unsubscribers = [];
  const lastDetectedFingerprintByStream = new Map();
  let started = false;

  const formulasByStream = new Map();

  for (const formula of formulas) {
    for (const symbol of formula.detection.symbols) {
      const streamKey = `${symbol}:${formula.detection.timeframe}`;
      const activeFormulas = formulasByStream.get(streamKey) ?? [];
      activeFormulas.push(formula);
      formulasByStream.set(streamKey, activeFormulas);
    }
  }

  const handleSnapshot = (panel, snapshot) => {
    if (!snapshot?.candles?.length) {
      return;
    }

    const formulasForPanel =
      formulasByStream.get(`${panel.symbol}:${panel.timeframe}`) ?? [];

    for (const formula of formulasForPanel) {
      const detector = detectors[formula.id];

      if (typeof detector !== "function") {
        continue;
      }

      const signal = detector(snapshot.candles);

      if (!signal) {
        continue;
      }

      const detectedCandle = getDetectedCandle(signal);
      const dedupeValue =
        detectedCandle?.openTime ??
        snapshot.lastEventTime ??
        snapshot.candles.at(-1)?.openTime;
      const dedupeKey = `${formula.id}:${panel.symbol}:${panel.timeframe}`;

      if (lastDetectedFingerprintByStream.get(dedupeKey) === dedupeValue) {
        continue;
      }

      lastDetectedFingerprintByStream.set(dedupeKey, dedupeValue);
      const alert = alertStore.recordMatch(
        createAlertPayload(formula, panel, signal, snapshot),
      );
      onMatch?.(alert, signal);
    }
  };

  return {
    start() {
      if (started) {
        return;
      }

      started = true;

      for (const panel of marketData.panels ?? []) {
        unsubscribers.push(
          marketData.subscribe(panel, (snapshot) => handleSnapshot(panel, snapshot)),
        );
      }
    },

    stop() {
      while (unsubscribers.length > 0) {
        const unsubscribe = unsubscribers.pop();
        unsubscribe?.();
      }

      started = false;
    },
  };
}
