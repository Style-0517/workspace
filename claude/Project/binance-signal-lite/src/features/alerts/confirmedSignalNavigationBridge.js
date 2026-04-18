import {
  createConfirmedSignalNavigationPayload,
  parseConfirmedSignalDeepLink,
} from "./confirmedSignalAlert.js";

export const CONFIRMED_SIGNAL_NOTIFICATION_TAP_EVENT =
  "binance-signal-lite:confirmed-signal-notification-tap";
export const CONFIRMED_SIGNAL_LAUNCH_PAYLOAD_WINDOW_KEY =
  "__BINANCE_SIGNAL_LITE_LAUNCH_PAYLOAD__";
export const CONFIRMED_SIGNAL_PENDING_STORAGE_KEY =
  "binance-signal-lite.confirmed-signal.launch";

function assertStorageLike(storage) {
  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    throw new Error("Storage implementation is required");
  }
}

function normalizeFromNavigationPayload(payload) {
  return createConfirmedSignalNavigationPayload({
    alertId: payload?.params?.alertId ?? payload?.alertId,
    symbol: payload?.params?.symbol ?? payload?.symbol,
    timeframe: payload?.params?.timeframe ?? payload?.timeframe,
    formulaId: payload?.params?.formulaId ?? payload?.formulaId ?? null,
  });
}

function normalizeLocationPayload(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (value.startsWith("binance-signal-lite://")) {
    return parseConfirmedSignalDeepLink(value);
  }

  const parsedUrl = new URL(value, "https://binance-signal-lite.local");
  const deepLink = parsedUrl.searchParams.get("confirmedSignalDeepLink")
    ?? parsedUrl.searchParams.get("deepLink");
  const payload = parsedUrl.searchParams.get("confirmedSignalPayload")
    ?? parsedUrl.searchParams.get("alertPayload");

  if (deepLink) {
    return parseConfirmedSignalDeepLink(deepLink);
  }

  if (payload) {
    return resolveConfirmedSignalNavigationPayload(JSON.parse(payload));
  }

  return null;
}

export function resolveConfirmedSignalNavigationPayload(input) {
  if (!input) {
    throw new Error("Confirmed signal navigation input is required");
  }

  if (typeof input === "string") {
    return parseConfirmedSignalDeepLink(input);
  }

  if (typeof input.deepLink === "string") {
    return parseConfirmedSignalDeepLink(input.deepLink);
  }

  if (input.navigation) {
    return normalizeFromNavigationPayload(input.navigation);
  }

  if (input.navigationPayload) {
    return normalizeFromNavigationPayload(input.navigationPayload);
  }

  if (input.payload) {
    return normalizeFromNavigationPayload(input.payload);
  }

  return normalizeFromNavigationPayload(input);
}

export function persistConfirmedSignalLaunchPayload(storage, input) {
  assertStorageLike(storage);
  const payload = resolveConfirmedSignalNavigationPayload(input);
  storage.setItem(
    CONFIRMED_SIGNAL_PENDING_STORAGE_KEY,
    JSON.stringify(payload),
  );
  return payload;
}

export function consumePersistedConfirmedSignalLaunchPayload(storage) {
  assertStorageLike(storage);
  const rawValue = storage.getItem(CONFIRMED_SIGNAL_PENDING_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  storage.removeItem(CONFIRMED_SIGNAL_PENDING_STORAGE_KEY);
  return resolveConfirmedSignalNavigationPayload(JSON.parse(rawValue));
}

export function readConfirmedSignalLaunchNavigation({
  windowRef = globalThis,
  storage = null,
} = {}) {
  const launchPayload = windowRef?.[CONFIRMED_SIGNAL_LAUNCH_PAYLOAD_WINDOW_KEY];

  if (launchPayload) {
    return {
      payload: resolveConfirmedSignalNavigationPayload(launchPayload),
      source: "launch-payload",
    };
  }

  const locationPayload = normalizeLocationPayload(windowRef?.location?.href);

  if (locationPayload) {
    return {
      payload: locationPayload,
      source: "location-deep-link",
    };
  }

  if (storage) {
    const persistedPayload = consumePersistedConfirmedSignalLaunchPayload(storage);

    if (persistedPayload) {
      return {
        payload: persistedPayload,
        source: "pending-storage",
      };
    }
  }

  return null;
}

function clearWindowLaunchPayload(windowRef) {
  if (!windowRef) {
    return;
  }

  try {
    delete windowRef[CONFIRMED_SIGNAL_LAUNCH_PAYLOAD_WINDOW_KEY];
  } catch {
    windowRef[CONFIRMED_SIGNAL_LAUNCH_PAYLOAD_WINDOW_KEY] = null;
  }
}

export function createConfirmedSignalNavigationBridge({
  windowRef = globalThis,
  storage = null,
  onNavigate,
} = {}) {
  if (typeof onNavigate !== "function") {
    throw new Error("onNavigate callback is required");
  }

  let isAttached = false;

  const openNotificationTap = (input) => {
    const payload = resolveConfirmedSignalNavigationPayload(input);
    onNavigate(payload, {
      source: "notification-tap",
    });
    return payload;
  };

  const handleNotificationTap = (event) => {
    openNotificationTap(event?.detail ?? event);
  };

  return {
    attach() {
      if (isAttached || typeof windowRef?.addEventListener !== "function") {
        return;
      }

      windowRef.addEventListener(
        CONFIRMED_SIGNAL_NOTIFICATION_TAP_EVENT,
        handleNotificationTap,
      );
      isAttached = true;
    },
    detach() {
      if (!isAttached || typeof windowRef?.removeEventListener !== "function") {
        return;
      }

      windowRef.removeEventListener(
        CONFIRMED_SIGNAL_NOTIFICATION_TAP_EVENT,
        handleNotificationTap,
      );
      isAttached = false;
    },
    consumeLaunchPayload() {
      const launchNavigation = readConfirmedSignalLaunchNavigation({
        windowRef,
        storage,
      });

      if (!launchNavigation) {
        return null;
      }

      clearWindowLaunchPayload(windowRef);
      onNavigate(launchNavigation.payload, {
        source: launchNavigation.source,
      });
      return launchNavigation.payload;
    },
    openNotificationTap,
  };
}
