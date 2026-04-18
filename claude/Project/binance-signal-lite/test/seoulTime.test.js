import test from "node:test";
import assert from "node:assert/strict";

import {
  formatSeoulDateTime,
  formatSeoulTime,
} from "../src/lib/seoulTime.js";

test("formatSeoulDateTime renders UTC timestamps in Korea time", () => {
  assert.equal(
    formatSeoulDateTime("2026-04-15T16:05:09.000Z", { suffix: true }),
    "4/16 01:05 KST",
  );
  assert.equal(
    formatSeoulDateTime("2026-04-15T16:05:09.000Z", {
      includeSeconds: true,
      padDate: true,
    }),
    "04/16 01:05:09",
  );
});

test("formatSeoulTime renders epoch values in Korea time", () => {
  const utcSeconds = Date.parse("2026-04-15T00:05:09.000Z") / 1000;

  assert.equal(formatSeoulTime(utcSeconds), "09:05");
  assert.equal(
    formatSeoulTime(utcSeconds, { includeSeconds: true, suffix: true }),
    "09:05:09 KST",
  );
});
