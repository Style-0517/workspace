import {
  DEFAULT_VIRTUAL_CASH_BALANCE,
  DEFAULT_VIRTUAL_CASH_CURRENCY,
  MOCK_ORDER_LEDGER_STORAGE_KEY,
} from "../../config/localStateStorage.js";
import {
  applyFilledOrderToPosition,
  buildPositionBook,
  getOrderResolvedQuantity,
  getPositionSnapshot,
} from "./orderAnalytics.js";

export const DEFAULT_ORDER_HISTORY_LIMIT = 64;

function createInitialState() {
  return {
    availableCash: DEFAULT_VIRTUAL_CASH_BALANCE,
    currency: DEFAULT_VIRTUAL_CASH_CURRENCY,
    orders: [],
  };
}

function cloneOrder(order) {
  return { ...order };
}

function cloneState(state) {
  return {
    availableCash: state.availableCash,
    currency: state.currency,
    orders: state.orders.map(cloneOrder),
  };
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function roundPrice(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizePositiveNumber(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return roundMoney(parsedValue);
}

function normalizePositivePrice(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return roundPrice(parsedValue);
}

function normalizeOrderType(value) {
  if (value === "limit" || value === "auto") {
    return value;
  }

  return "market";
}

function normalizeOrderStatus(value) {
  if (value === "pending" || value === "rejected") {
    return value;
  }

  return "filled";
}

function canFillLimitOrder({ side, referencePrice, marketPrice }) {
  if (!Number.isFinite(referencePrice) || !Number.isFinite(marketPrice)) {
    return false;
  }

  if (side === "sell") {
    return marketPrice >= referencePrice;
  }

  return marketPrice <= referencePrice;
}

function resolveNextBalance({ availableCash, side, notional }) {
  return side === "buy"
    ? roundMoney(availableCash - notional)
    : roundMoney(availableCash + notional);
}

function parseStoredState(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(rawValue);
    const availableCash = Number(parsed?.availableCash);
    const currency =
      typeof parsed?.currency === "string"
        ? parsed.currency
        : DEFAULT_VIRTUAL_CASH_CURRENCY;
    const orders = Array.isArray(parsed?.orders)
      ? parsed.orders
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: String(item.id),
            symbol: String(item.symbol),
            timeframe: String(item.timeframe),
            formulaId: String(item.formulaId),
            side: item.side === "sell" ? "sell" : "buy",
            orderType: normalizeOrderType(item.orderType),
            status: normalizeOrderStatus(item.status),
            notional: Number(item.notional),
            referencePrice:
              item.referencePrice == null
                ? null
                : normalizePositivePrice(item.referencePrice),
            executionPrice:
              item.executionPrice == null
                ? null
                : normalizePositivePrice(item.executionPrice),
            quantity:
              item.quantity == null
                ? null
                : (() => {
                    const quantity = Number(item.quantity);
                    return Number.isFinite(quantity) && quantity > 0
                      ? quantity
                      : null;
                  })(),
            marketPriceAtPlacement:
              item.marketPriceAtPlacement == null
                ? null
                : normalizePositivePrice(item.marketPriceAtPlacement),
            note: String(item.note ?? ""),
            sourceAlertId:
              typeof item.sourceAlertId === "string" ? item.sourceAlertId : null,
            placedAt: String(item.placedAt),
            filledAt:
              typeof item.filledAt === "string" ? item.filledAt : null,
            rejectedAt:
              typeof item.rejectedAt === "string" ? item.rejectedAt : null,
            rejectionReason: String(item.rejectionReason ?? ""),
            balanceAfterOrder: Number(item.balanceAfterOrder),
          }))
      : [];

    return {
      availableCash: Number.isFinite(availableCash)
        ? availableCash
        : DEFAULT_VIRTUAL_CASH_BALANCE,
      currency,
      orders,
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

export function createMockOrderLedger({
  storage = null,
  storageKey = MOCK_ORDER_LEDGER_STORAGE_KEY,
  maxOrders = DEFAULT_ORDER_HISTORY_LIMIT,
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

    placeOrder(input) {
      const notional = normalizePositiveNumber(input.notional);

      if (!notional) {
        return {
          ok: false,
          error: "투입 금액은 0보다 커야 합니다.",
        };
      }

      const side = input.side === "sell" ? "sell" : "buy";
      const orderType = normalizeOrderType(input.orderType);
      const referencePrice = normalizePositivePrice(input.referencePrice);
      const marketPrice = normalizePositivePrice(input.marketPrice);
      const placedAt = String(input.placedAt ?? new Date().toISOString());
      const sourceAlertId =
        typeof input.sourceAlertId === "string" && input.sourceAlertId.length > 0
          ? input.sourceAlertId
          : null;

      if (orderType === "limit" && !referencePrice) {
        return {
          ok: false,
          error: "지정가 주문은 주문 가격을 입력해야 합니다.",
        };
      }

      if (orderType === "auto" && !sourceAlertId) {
        return {
          ok: false,
          error: "자동 주문은 먼저 적용할 신호를 선택해야 합니다.",
        };
      }

      const shouldFillImmediately =
        orderType !== "limit"
          || canFillLimitOrder({
            side,
            referencePrice,
            marketPrice,
          });
      const executionPrice =
        orderType === "market"
          ? marketPrice ?? referencePrice
          : orderType === "auto"
            ? referencePrice ?? marketPrice
            : shouldFillImmediately
              ? referencePrice
              : null;

      if (orderType === "auto" && !executionPrice) {
        return {
          ok: false,
          error: "자동 주문을 실행할 기준 가격이 아직 없습니다.",
        };
      }

      const quantity = getOrderResolvedQuantity({
        notional,
        quantity: input.quantity,
        executionPrice,
        referencePrice,
        marketPriceAtPlacement: marketPrice,
      });

      if (side === "sell") {
        const positionBook = buildPositionBook(state.orders);
        const position = getPositionSnapshot(positionBook, String(input.symbol));

        if (position.quantity <= 0) {
          return {
            ok: false,
            error: "보유 중인 포지션이 없어 매도할 수 없습니다.",
          };
        }

        if (quantity && quantity > position.quantity + 0.000001) {
          return {
            ok: false,
            error: "보유 수량보다 큰 매도 주문은 넣을 수 없습니다.",
          };
        }
      }

      let nextBalance = state.availableCash;

      if (shouldFillImmediately) {
        nextBalance = resolveNextBalance({
          availableCash: state.availableCash,
          side,
          notional,
        });
      }

      if (shouldFillImmediately && side === "buy" && nextBalance < 0) {
        return {
          ok: false,
          error: "가상 잔고보다 큰 금액은 진입할 수 없습니다.",
        };
      }

      const order = {
        id: `order:${Date.now()}:${state.orders.length + 1}`,
        symbol: String(input.symbol),
        timeframe: String(input.timeframe),
        formulaId: String(input.formulaId),
        side,
        orderType,
        status: shouldFillImmediately ? "filled" : "pending",
        notional,
        referencePrice,
        executionPrice,
        quantity,
        marketPriceAtPlacement: marketPrice,
        note: String(input.note ?? ""),
        sourceAlertId,
        placedAt,
        filledAt: shouldFillImmediately ? placedAt : null,
        rejectedAt: null,
        rejectionReason: "",
        balanceAfterOrder: shouldFillImmediately
          ? nextBalance
          : state.availableCash,
      };

      commit({
        ...state,
        availableCash: shouldFillImmediately ? nextBalance : state.availableCash,
        orders: [order, ...state.orders].slice(0, maxOrders),
      });

      return {
        ok: true,
        order: cloneOrder(order),
        balance: shouldFillImmediately ? nextBalance : state.availableCash,
      };
    },

    processMarketTick({
      symbol,
      lastPrice,
      tickedAt = new Date().toISOString(),
    } = {}) {
      const normalizedSymbol = String(symbol ?? "");
      const marketPrice = normalizePositivePrice(lastPrice);

      if (!normalizedSymbol || !marketPrice) {
        return {
          ok: false,
          filledOrders: [],
          rejectedOrders: [],
        };
      }

      let nextBalance = state.availableCash;
      let hasChanged = false;
      const filledOrders = [];
      const rejectedOrders = [];
      const nextOrders = state.orders.map(cloneOrder);
      const positionBook = buildPositionBook(nextOrders);
      const pendingCandidates = nextOrders
        .filter(
          (order) => order.status === "pending"
            && order.orderType === "limit"
            && order.symbol === normalizedSymbol
            && canFillLimitOrder({
              side: order.side,
              referencePrice: order.referencePrice,
              marketPrice,
            }),
        )
        .sort((left, right) => (
          new Date(left.placedAt).getTime() - new Date(right.placedAt).getTime()
        ));

      pendingCandidates.forEach((order) => {
        const targetOrder = nextOrders.find((item) => item.id === order.id);

        if (!targetOrder) {
          return;
        }

        const executionPrice = targetOrder.referencePrice ?? marketPrice;
        const quantity = getOrderResolvedQuantity({
          ...targetOrder,
          executionPrice,
        });

        if (targetOrder.side === "buy") {
          const filledBalance = resolveNextBalance({
            availableCash: nextBalance,
            side: targetOrder.side,
            notional: targetOrder.notional,
          });

          if (filledBalance < 0) {
            hasChanged = true;
            Object.assign(targetOrder, {
              status: "rejected",
              rejectedAt: tickedAt,
              rejectionReason: "잔고 부족",
              balanceAfterOrder: nextBalance,
            });
            rejectedOrders.push(cloneOrder(targetOrder));
            return;
          }

          nextBalance = filledBalance;
        } else {
          const position = getPositionSnapshot(positionBook, targetOrder.symbol);

          if (position.quantity <= 0 || (quantity && quantity > position.quantity + 0.000001)) {
            hasChanged = true;
            Object.assign(targetOrder, {
              status: "rejected",
              rejectedAt: tickedAt,
              rejectionReason: "보유 수량 부족",
              balanceAfterOrder: nextBalance,
            });
            rejectedOrders.push(cloneOrder(targetOrder));
            return;
          }

          nextBalance = resolveNextBalance({
            availableCash: nextBalance,
            side: targetOrder.side,
            notional: targetOrder.notional,
          });
        }

        hasChanged = true;
        Object.assign(targetOrder, {
          status: "filled",
          executionPrice,
          quantity,
          filledAt: tickedAt,
          rejectedAt: null,
          rejectionReason: "",
          balanceAfterOrder: nextBalance,
        });
        applyFilledOrderToPosition(positionBook, targetOrder);
        filledOrders.push(cloneOrder(targetOrder));
      });

      if (!hasChanged) {
        return {
          ok: true,
          filledOrders,
          rejectedOrders,
          balance: nextBalance,
        };
      }

      commit({
        ...state,
        availableCash: nextBalance,
        orders: nextOrders,
      });

      return {
        ok: true,
        filledOrders,
        rejectedOrders,
        balance: nextBalance,
      };
    },

    reset() {
      commit(createInitialState());
      return cloneState(state);
    },
  };
}
