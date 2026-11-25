import assert from "node:assert/strict";
import test from "node:test";
import { expiredSessionIds } from "../src/cleanup.ts";

const hour = 60 * 60 * 1000;

test("selects sessions older than the max age and keeps the rest", () => {
  const now = Date.parse("2026-11-25T10:00:00Z");
  const ids = expiredSessionIds(
    [
      { sessionId: "fresh", startTime: new Date(now - hour) },
      { sessionId: "stale", startTime: new Date(now - 25 * hour) },
      { sessionId: "boundary", startTime: new Date(now - 24 * hour) },
      { sessionId: "invalid", startTime: new Date(Number.NaN) },
    ],
    now,
    24 * hour,
  );
  assert.deepEqual(ids, ["stale"]);
});
