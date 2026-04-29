import { describe, expect, it } from "vitest";

import { formatLineForCopy } from "@/lib/copy-lines";
import type { LogLine } from "@/types/log";

/**
 * Pure-function coverage for the Copy line clipboard format. The
 * integration test in log-explorer.test.tsx exercises the path through
 * navigator.clipboard; this file pins the exact text shape so changes
 * land in one place.
 */

const T = (offset: number) => Date.UTC(2026, 3, 27, 14, 32, offset);

describe("formatLineForCopy", () => {
  it("formats an INFO line with timestamp + instance + message (no level prefix)", () => {
    const line: LogLine = {
      id: "l1",
      timestamp: T(8),
      instance: "7tbsm",
      level: "INFO",
      message: "GET /api/users 200 in 42ms",
    };
    expect(formatLineForCopy(line)).toBe(
      "2026-04-27T14:32:08.000Z [7tbsm] GET /api/users 200 in 42ms",
    );
  });

  it("includes the level prefix for WARN", () => {
    const line: LogLine = {
      id: "l2",
      timestamp: T(9),
      instance: "7tbsm",
      level: "WARN",
      message: "Slow query took 1247ms",
    };
    expect(formatLineForCopy(line)).toBe(
      "2026-04-27T14:32:09.000Z [7tbsm] WARN Slow query took 1247ms",
    );
  });

  it("includes the level prefix for ERROR", () => {
    const line: LogLine = {
      id: "l3",
      timestamp: T(10),
      instance: "a3kx2",
      level: "ERROR",
      message: "db connection refused",
    };
    expect(formatLineForCopy(line)).toBe(
      "2026-04-27T14:32:10.000Z [a3kx2] ERROR db connection refused",
    );
  });

  it("omits the level prefix for DEBUG (matches the rendered UI)", () => {
    const line: LogLine = {
      id: "l4",
      timestamp: T(11),
      instance: "7tbsm",
      level: "DEBUG",
      message: "GC paused 14ms",
    };
    expect(formatLineForCopy(line)).toBe(
      "2026-04-27T14:32:11.000Z [7tbsm] GC paused 14ms",
    );
  });

  it("appends the request id at the end when present", () => {
    const line: LogLine = {
      id: "l5",
      timestamp: T(12),
      instance: "7tbsm",
      level: "INFO",
      message: "POST /login 200",
      requestId: "req_a3f9c2",
    };
    expect(formatLineForCopy(line)).toBe(
      "2026-04-27T14:32:12.000Z [7tbsm] POST /login 200 req_a3f9c2",
    );
  });

  it("returns the deploy-boundary message verbatim (no timestamp / instance decoration)", () => {
    const line: LogLine = {
      id: "deploy_a",
      timestamp: T(13),
      instance: "7tbsm",
      level: "INFO",
      message: "🎉 Deploy live · srv-7tbsm@a3f2c1",
      isDeployBoundary: true,
    };
    expect(formatLineForCopy(line)).toBe(
      "🎉 Deploy live · srv-7tbsm@a3f2c1",
    );
  });
});
