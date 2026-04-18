function parseTime(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function roundPrice(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundQuantity(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundPercent(value) {
  return Math.round(value * 100) / 100;
}

export function getOrderResolvedPrice(order) {
  const value = Number(
    order?.executionPrice
      ?? order?.referencePrice
      ?? order?.marketPriceAtPlacement,
  );

  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getOrderResolvedQuantity(order) {
  const explicitQuantity = Number(order?.quantity);

  if (Number.isFinite(explicitQuantity) && explicitQuantity > 0) {
    return roundQuantity(explicitQuantity);
  }

  const price = getOrderResolvedPrice(order);
  const notional = Number(order?.notional);

  if (!price || !Number.isFinite(notional) || notional <= 0) {
    return null;
  }

  return roundQuantity(notional / price);
}

function sortOrdersChronologically(orders = []) {
  return [...orders].sort((left, right) => {
    const leftTime = parseTime(left?.filledAt ?? left?.placedAt);
    const rightTime = parseTime(right?.filledAt ?? right?.placedAt);
    return leftTime - rightTime;
  });
}

function ensurePosition(positionBook, symbol) {
  if (!positionBook.has(symbol)) {
    positionBook.set(symbol, {
      symbol,
      quantity: 0,
      costBasis: 0,
      avgEntryPrice: null,
      realizedPnl: 0,
      totalBoughtNotional: 0,
      totalSoldNotional: 0,
      closedTrades: [],
      latestEntryAt: null,
      latestExitAt: null,
    });
  }

  return positionBook.get(symbol);
}

export function applyFilledOrderToPosition(positionBook, order) {
  if (!order || order.status !== "filled") {
    return {
      applied: false,
      quantity: 0,
      realizedPnl: 0,
    };
  }

  const symbol = String(order.symbol ?? "");
  const position = ensurePosition(positionBook, symbol);
  const price = getOrderResolvedPrice(order);
  const quantity = getOrderResolvedQuantity(order);

  if (!price || !quantity) {
    return {
      applied: false,
      quantity: 0,
      realizedPnl: 0,
    };
  }

  if (order.side === "sell") {
    const closeQuantity = Math.min(position.quantity, quantity);

    if (closeQuantity <= 0) {
      return {
        applied: false,
        quantity: 0,
        realizedPnl: 0,
      };
    }

    const averageEntry = position.quantity > 0
      ? position.costBasis / position.quantity
      : 0;
    const proceeds = closeQuantity * price;
    const removedCost = closeQuantity * averageEntry;
    const realizedPnl = proceeds - removedCost;

    position.quantity = roundQuantity(position.quantity - closeQuantity);
    position.costBasis = roundMoney(Math.max(0, position.costBasis - removedCost));
    position.realizedPnl = roundMoney(position.realizedPnl + realizedPnl);
    position.totalSoldNotional = roundMoney(position.totalSoldNotional + proceeds);
    position.avgEntryPrice = position.quantity > 0
      ? roundPrice(position.costBasis / position.quantity)
      : null;
    position.latestExitAt = order.filledAt ?? order.placedAt ?? null;
    position.closedTrades.push({
      orderId: order.id,
      quantity: closeQuantity,
      price,
      pnl: roundMoney(realizedPnl),
      pnlPct: removedCost > 0
        ? roundPercent((realizedPnl / removedCost) * 100)
        : null,
      closedAt: order.filledAt ?? order.placedAt ?? null,
    });

    return {
      applied: true,
      quantity: closeQuantity,
      realizedPnl: roundMoney(realizedPnl),
    };
  }

  position.quantity = roundQuantity(position.quantity + quantity);
  position.costBasis = roundMoney(position.costBasis + Number(order.notional ?? 0));
  position.realizedPnl = roundMoney(position.realizedPnl);
  position.totalBoughtNotional = roundMoney(
    position.totalBoughtNotional + Number(order.notional ?? 0),
  );
  position.avgEntryPrice = position.quantity > 0
    ? roundPrice(position.costBasis / position.quantity)
    : null;
  position.latestEntryAt = order.filledAt ?? order.placedAt ?? null;

  return {
    applied: true,
    quantity,
    realizedPnl: 0,
  };
}

export function buildPositionBook(orders = []) {
  const positionBook = new Map();

  sortOrdersChronologically(
    orders.filter((order) => order && typeof order === "object" && order.status === "filled"),
  ).forEach((order) => {
    applyFilledOrderToPosition(positionBook, order);
  });

  return positionBook;
}

export function getPositionSnapshot(positionBook, symbol) {
  const position = positionBook.get(symbol);

  if (!position) {
    return {
      symbol,
      quantity: 0,
      costBasis: 0,
      avgEntryPrice: null,
      realizedPnl: 0,
      totalBoughtNotional: 0,
      totalSoldNotional: 0,
      closedTrades: [],
      latestEntryAt: null,
      latestExitAt: null,
    };
  }

  return {
    ...position,
    closedTrades: [...position.closedTrades],
  };
}

export function summarizeOrderPerformance({
  orders = [],
  symbol = "",
  marketPrice = null,
} = {}) {
  const filteredOrders = orders.filter(
    (order) => order && typeof order === "object" && (!symbol || order.symbol === symbol),
  );
  const positionBook = buildPositionBook(filteredOrders);
  const position = getPositionSnapshot(positionBook, symbol);
  const resolvedMarketPrice = Number.isFinite(Number(marketPrice))
    ? Number(marketPrice)
    : null;
  const pendingOrders = filteredOrders.filter((order) => order.status === "pending");
  const marketValue = resolvedMarketPrice != null
    ? roundMoney(position.quantity * resolvedMarketPrice)
    : null;
  const unrealizedPnl = marketValue != null
    ? roundMoney(marketValue - position.costBasis)
    : null;
  const unrealizedPnlPct = unrealizedPnl != null && position.costBasis > 0
    ? roundPercent((unrealizedPnl / position.costBasis) * 100)
    : null;
  const totalPnl = unrealizedPnl == null
    ? roundMoney(position.realizedPnl)
    : roundMoney(position.realizedPnl + unrealizedPnl);
  const returnBase = position.costBasis > 0
    ? position.costBasis
    : position.totalBoughtNotional > 0
      ? position.totalBoughtNotional
      : null;
  const totalPnlPct = returnBase
    ? roundPercent((totalPnl / returnBase) * 100)
    : null;
  const closedTrades = [...position.closedTrades];
  const winCount = closedTrades.filter((trade) => trade.pnl > 0).length;
  const lossCount = closedTrades.filter((trade) => trade.pnl < 0).length;
  const winRate = closedTrades.length > 0
    ? roundPercent((winCount / closedTrades.length) * 100)
    : null;

  return {
    position: {
      ...position,
      marketPrice: resolvedMarketPrice,
      marketValue,
      unrealizedPnl,
      unrealizedPnlPct,
      totalPnl,
      totalPnlPct,
      pendingOrderCount: pendingOrders.length,
    },
    stats: {
      filledCount: filteredOrders.filter((order) => order.status === "filled").length,
      pendingCount: pendingOrders.length,
      closedTradeCount: closedTrades.length,
      winCount,
      lossCount,
      winRate,
    },
  };
}

export function buildTradeMarkers({
  orders = [],
  symbol = "",
  limit = 20,
} = {}) {
  return sortOrdersChronologically(
    orders.filter(
      (order) => order && typeof order === "object" && (!symbol || order.symbol === symbol),
    ),
  )
    .slice(-limit)
    .map((order) => {
      const eventTime = order.status === "filled"
        ? order.filledAt ?? order.placedAt
        : order.placedAt;
      const timestamp = parseTime(eventTime);

      if (!timestamp) {
        return null;
      }

      if (order.status === "pending") {
        return {
          time: Math.floor(timestamp / 1000),
          position: order.side === "sell" ? "aboveBar" : "belowBar",
          color: "#b88a1f",
          shape: "circle",
          text: "대기",
        };
      }

      if (order.side === "sell") {
        return {
          time: Math.floor(timestamp / 1000),
          position: "aboveBar",
          color: "#4f7cff",
          shape: "arrowDown",
          text: "매도",
        };
      }

      return {
        time: Math.floor(timestamp / 1000),
        position: "belowBar",
        color: "#df5b5b",
        shape: "arrowUp",
        text: "매수",
      };
    })
    .filter(Boolean);
}
