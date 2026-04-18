export const SEOUL_TIME_ZONE = "Asia/Seoul";

const DATE_TIME_FORMATTERS = new Map();

function getDateTimeFormatter({ includeSeconds = false } = {}) {
  const cacheKey = includeSeconds ? "with-seconds" : "without-seconds";

  if (DATE_TIME_FORMATTERS.has(cacheKey)) {
    return DATE_TIME_FORMATTERS.get(cacheKey);
  }

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  });

  DATE_TIME_FORMATTERS.set(cacheKey, formatter);
  return formatter;
}

function normalizeDateInput(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const normalizedValue = Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(normalizedValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (
    value &&
    typeof value === "object" &&
    Number.isInteger(value.year) &&
    Number.isInteger(value.month) &&
    Number.isInteger(value.day)
  ) {
    const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function getDateTimeParts(value, { includeSeconds = false } = {}) {
  const date = normalizeDateInput(value);

  if (!date) {
    return null;
  }

  const partEntries = getDateTimeFormatter({ includeSeconds })
    .formatToParts(date)
    .filter(({ type }) => type !== "literal")
    .map(({ type, value: partValue }) => [type, partValue]);

  return Object.fromEntries(partEntries);
}

export function formatSeoulDateTime(
  value,
  {
    includeDate = true,
    includeSeconds = false,
    padDate = false,
    suffix = false,
    fallback = "--",
  } = {},
) {
  const parts = getDateTimeParts(value, { includeSeconds });

  if (!parts) {
    return fallback;
  }

  const month = padDate
    ? String(parts.month).padStart(2, "0")
    : String(Number(parts.month));
  const day = padDate
    ? String(parts.day).padStart(2, "0")
    : String(Number(parts.day));
  const timeLabel = includeSeconds
    ? `${parts.hour}:${parts.minute}:${parts.second}`
    : `${parts.hour}:${parts.minute}`;
  const dateLabel = includeDate ? `${month}/${day} ` : "";
  const suffixLabel = suffix ? " KST" : "";

  return `${dateLabel}${timeLabel}${suffixLabel}`.trim();
}

export function formatSeoulTime(
  value,
  { includeSeconds = false, suffix = false, fallback = "--:--" } = {},
) {
  return formatSeoulDateTime(value, {
    includeDate: false,
    includeSeconds,
    suffix,
    fallback,
  });
}
