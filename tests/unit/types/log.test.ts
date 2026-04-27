import { describe, expect, it } from "vitest";

import type { DerivedLogLine, Level, LogLine } from "@/types/log";

/**
 * These tests exist mostly to lock the type shape in place — if a required
 * field is renamed or removed, the construction below will fail to compile
 * and surface the change at review time. The runtime assertions are a
 * lightweight sanity check on the same fixtures.
 */
describe("LogLine type", () => {
  it("accepts a minimal line with no requestId or deploy-boundary marker", () => {
    const line: LogLine = {
      id: "log_0001",
      timestamp: 1714224000000,
      instance: "7tbsm",
      level: "INFO",
      message: "Server listening on port 3000",
    };

    expect(line.id).toBe("log_0001");
    expect(line.requestId).toBeUndefined();
    expect(line.isDeployBoundary).toBeUndefined();
  });

  it("accepts a line with a requestId", () => {
    const line: LogLine = {
      id: "log_0002",
      timestamp: 1714224001000,
      instance: "7tbsm",
      requestId: "req_a3f9c2",
      level: "INFO",
      message: "GET /api/users 200 in 42ms",
    };

    expect(line.requestId).toBe("req_a3f9c2");
  });

  it("accepts a deploy-boundary line", () => {
    const line: LogLine = {
      id: "log_0003",
      timestamp: 1714224500000,
      instance: "7tbsm",
      level: "INFO",
      message: "🎉 Deploy live · srv-7tbsm@a3f2c1",
      isDeployBoundary: true,
    };

    expect(line.isDeployBoundary).toBe(true);
  });

  it("accepts each level value", () => {
    const levels: Level[] = ["INFO", "WARN", "ERROR", "DEBUG"];
    expect(levels).toHaveLength(4);
  });
});

describe("DerivedLogLine type", () => {
  it("extends LogLine with isVisible and isDimmed flags", () => {
    const derived: DerivedLogLine = {
      id: "log_0001",
      timestamp: 1714224000000,
      instance: "7tbsm",
      level: "INFO",
      message: "Server listening on port 3000",
      isVisible: true,
      isDimmed: false,
    };

    expect(derived.isVisible).toBe(true);
    expect(derived.isDimmed).toBe(false);
  });
});
