import test from "node:test";
import assert from "node:assert/strict";

import { createConfirmedSignalAlert } from "../src/features/alerts/confirmedSignalAlert.js";
import {
  CONFIRMED_SIGNAL_LAUNCH_PAYLOAD_WINDOW_KEY,
  CONFIRMED_SIGNAL_NOTIFICATION_TAP_EVENT,
  consumePersistedConfirmedSignalLaunchPayload,
  createConfirmedSignalNavigationBridge,
  persistConfirmedSignalLaunchPayload,
} from "../src/features/alerts/confirmedSignalNavigationBridge.js";

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createWindowHarness({ href = "https://binance-signal-lite.local/" } = {}) {
  const listeners = new Map();

  return {
    location: { href },
    addEventListener(type, listener) {
      const activeListeners = listeners.get(type) ?? new Set();
      activeListeners.add(listener);
      listeners.set(type, activeListeners);
    },
    removeEventListener(type, listener) {
      const activeListeners = listeners.get(type);

      if (!activeListeners) {
        return;
      }

      activeListeners.delete(listener);
    },
    dispatchEvent(event) {
      const activeListeners = listeners.get(event.type) ?? new Set();
      activeListeners.forEach((listener) => listener(event));
    },
  };
}

test("실행 중인 앱은 확정 시그널 알림 탭 이벤트로 즉시 라우팅된다", () => {
  const windowRef = createWindowHarness();
  const routedPayloads = [];
  const bridge = createConfirmedSignalNavigationBridge({
    windowRef,
    onNavigate: (payload, meta) => {
      routedPayloads.push({ payload, meta });
    },
  });

  bridge.attach();
  windowRef.dispatchEvent({
    type: CONFIRMED_SIGNAL_NOTIFICATION_TAP_EVENT,
    detail: createConfirmedSignalAlert({
      alertId: "ema-101",
      symbol: "BTCUSDT",
      timeframe: "1m",
      formulaId: "ema-pullback-reclaim-1m",
      signalType: "trend-continuation",
      rationale: "close reclaim confirmed",
    }),
  });

  assert.equal(routedPayloads.length, 1);
  assert.equal(routedPayloads[0].meta.source, "notification-tap");
  assert.equal(routedPayloads[0].payload.routeKey, "BTCUSDT:1m");
  bridge.detach();
});

test("종료 상태 launch payload는 앱 부팅 직후 소비되어 signal route로 들어간다", () => {
  const windowRef = createWindowHarness();
  const routedPayloads = [];
  windowRef[CONFIRMED_SIGNAL_LAUNCH_PAYLOAD_WINDOW_KEY] = {
    deepLink:
      "binance-signal-lite://signal-detail?alertId=rev-202&symbol=ETHUSDT&timeframe=5m&formulaId=bollinger-squeeze-breakout-5m",
  };

  const bridge = createConfirmedSignalNavigationBridge({
    windowRef,
    onNavigate: (payload, meta) => {
      routedPayloads.push({ payload, meta });
    },
  });

  const consumedPayload = bridge.consumeLaunchPayload();

  assert.ok(consumedPayload);
  assert.equal(consumedPayload.routeKey, "ETHUSDT:5m");
  assert.equal(routedPayloads.length, 1);
  assert.equal(routedPayloads[0].meta.source, "launch-payload");
  assert.equal(
    windowRef[CONFIRMED_SIGNAL_LAUNCH_PAYLOAD_WINDOW_KEY],
    undefined,
  );
});

test("보관된 launch payload는 다음 앱 시작에서 복원된 뒤 제거된다", () => {
  const storage = createMemoryStorage();

  persistConfirmedSignalLaunchPayload(storage, {
    alertId: "orb-303",
    symbol: "BTCUSDT",
    timeframe: "5m",
    formulaId: "opening-range-breakout-1m",
  });

  const restoredPayload = consumePersistedConfirmedSignalLaunchPayload(storage);

  assert.ok(restoredPayload);
  assert.equal(restoredPayload.routeKey, "BTCUSDT:5m");
  assert.equal(consumePersistedConfirmedSignalLaunchPayload(storage), null);
});
