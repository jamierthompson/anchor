import { describe, expect, it } from "vitest";

import {
  INSTANCES,
  MOCK_START_MS,
  PREAMBLE_START_MS,
  REQUEST_IDS,
  liveTailSeed,
  mockLogs,
  type InstanceId,
} from "@/lib/mock-logs";

/**
 * These tests guard the demo's invariants. They're not full coverage of
 * every line — they enforce the structural promises the spec makes about
 * the fixture so future edits can't silently break a demo path.
 */

const minuteOf = (timestampMs: number): number =>
  Math.floor((timestampMs - MOCK_START_MS) / 60_000);

describe("mockLogs — volume and timing", () => {
  it("contains a workable demo volume of lines", () => {
    expect(mockLogs.length).toBeGreaterThanOrEqual(350);
    expect(mockLogs.length).toBeLessThanOrEqual(450);
  });

  it("starts with a prior-day preamble before MOCK_START_MS", () => {
    const first = mockLogs[0];
    expect(first.timestamp).toBeGreaterThanOrEqual(PREAMBLE_START_MS);
    expect(first.timestamp).toBeLessThan(MOCK_START_MS);
  });

  it("the main story arc (lines from MOCK_START_MS onward) spans roughly one hour", () => {
    const arc = mockLogs.filter((l) => l.timestamp >= MOCK_START_MS);
    expect(arc.length).toBeGreaterThan(0);
    const spanMinutes =
      (arc[arc.length - 1].timestamp - arc[0].timestamp) / 60_000;
    expect(spanMinutes).toBeGreaterThan(55);
    expect(spanMinutes).toBeLessThan(65);
  });

  it("has monotonically non-decreasing timestamps", () => {
    for (let i = 1; i < mockLogs.length; i++) {
      expect(
        mockLogs[i].timestamp,
        `line ${mockLogs[i].id} (${i}) precedes line ${mockLogs[i - 1].id}`,
      ).toBeGreaterThanOrEqual(mockLogs[i - 1].timestamp);
    }
  });

  it("assigns unique ids to every line", () => {
    const ids = new Set(mockLogs.map((l) => l.id));
    expect(ids.size).toBe(mockLogs.length);
  });
});

describe("mockLogs — instances and request IDs", () => {
  it("only uses the three declared instances", () => {
    const seen = new Set(mockLogs.map((l) => l.instance));
    expect(seen).toEqual(new Set(INSTANCES));
  });

  it("references every declared request ID", () => {
    const seen = new Set(
      mockLogs.map((l) => l.requestId).filter((r): r is string => Boolean(r)),
    );
    for (const reqId of Object.keys(REQUEST_IDS)) {
      expect(seen, `missing requestId ${reqId}`).toContain(reqId);
    }
  });

  it("attaches each request ID to its declared instance only", () => {
    for (const line of mockLogs) {
      if (!line.requestId) continue;
      const expectedInstance =
        REQUEST_IDS[line.requestId as keyof typeof REQUEST_IDS];
      expect(
        line.instance,
        `${line.id}: requestId ${line.requestId} on wrong instance`,
      ).toBe(expectedInstance);
    }
  });
});

describe("mockLogs — level distribution", () => {
  // Tolerances are loose enough to allow story-arc-driven adjustment but
  // tight enough to flag a structural drift (e.g. forgetting to mark
  // ERRORs in the cluster).
  const within = (actual: number, target: number, tolerance: number) =>
    Math.abs(actual - target) <= tolerance;

  it("matches the target level distribution within tolerance", () => {
    const total = mockLogs.length;
    const counts = { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
    for (const line of mockLogs) counts[line.level]++;

    const ratio = (n: number) => n / total;

    expect(within(ratio(counts.INFO), 0.7, 0.1)).toBe(true);
    expect(within(ratio(counts.WARN), 0.2, 0.1)).toBe(true);
    expect(within(ratio(counts.ERROR), 0.08, 0.04)).toBe(true);
    expect(within(ratio(counts.DEBUG), 0.02, 0.02)).toBe(true);
  });
});

describe("mockLogs — story arc anchors", () => {
  it("contains exactly two deploy boundaries", () => {
    const boundaries = mockLogs.filter((l) => l.isDeployBoundary);
    expect(boundaries).toHaveLength(2);
  });

  it("places deploy boundaries at the spec's beats (~min 8 and ~min 38)", () => {
    const boundaries = mockLogs.filter((l) => l.isDeployBoundary);
    const minutes = boundaries.map((l) => minuteOf(l.timestamp));
    expect(minutes[0]).toBe(8);
    expect(minutes[1]).toBe(38);
  });

  it("clusters errors on instance 7tbsm between minutes 32 and 36", () => {
    const errors = mockLogs.filter((l) => l.level === "ERROR");
    expect(errors.length).toBeGreaterThanOrEqual(20);

    const inCluster = errors.filter((l) => {
      const m = minuteOf(l.timestamp);
      return m >= 32 && m <= 36 && l.instance === "7tbsm";
    });

    // The cluster should account for the overwhelming majority of errors.
    expect(inCluster.length / errors.length).toBeGreaterThan(0.9);
  });
});

describe("mockLogs — cross-instance interleaving", () => {
  it("surfaces ≥2 instances in every minute window that has multiple lines", () => {
    const byMinute = new Map<number, Set<InstanceId>>();
    for (const line of mockLogs) {
      const m = minuteOf(line.timestamp);
      const set = byMinute.get(m) ?? new Set<InstanceId>();
      set.add(line.instance as InstanceId);
      byMinute.set(m, set);
    }

    const offenders: number[] = [];
    for (const [minute, instances] of byMinute) {
      const lineCount = mockLogs.filter(
        (l) => minuteOf(l.timestamp) === minute,
      ).length;
      // Single-line minutes can't interleave by definition — skip them.
      if (lineCount > 1 && instances.size < 2) offenders.push(minute);
    }

    expect(
      offenders,
      `minutes lacking cross-instance interleaving: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

describe("liveTailSeed — streaming continuation of the story arc", () => {
  it("contains a demo-friendly count of streamed lines", () => {
    expect(liveTailSeed.length).toBeGreaterThanOrEqual(20);
    expect(liveTailSeed.length).toBeLessThanOrEqual(60);
  });

  it("every entry has a unique id, none collide with mockLogs", () => {
    const allIds = new Set([
      ...mockLogs.map((l) => l.id),
      ...liveTailSeed.map((l) => l.id),
    ]);
    expect(allIds.size).toBe(mockLogs.length + liveTailSeed.length);
  });

  it("timestamps continue past the end of mockLogs and are non-decreasing", () => {
    const lastMockTs = mockLogs[mockLogs.length - 1].timestamp;
    expect(liveTailSeed[0].timestamp).toBeGreaterThanOrEqual(lastMockTs);
    for (let i = 1; i < liveTailSeed.length; i++) {
      expect(liveTailSeed[i].timestamp).toBeGreaterThanOrEqual(
        liveTailSeed[i - 1].timestamp,
      );
    }
  });

  it("delayMs values are within reasonable wall-clock cadence bounds", () => {
    // Hand-curated cadence — bursts (~200-450ms) + quiet stretches
    // (~1500-2500ms). Outside these bounds suggests a typo (e.g. 30000
    // instead of 3000); inside is the curated rhythm.
    for (const entry of liveTailSeed) {
      expect(entry.delayMs).toBeGreaterThanOrEqual(150);
      expect(entry.delayMs).toBeLessThanOrEqual(3000);
    }
  });

  it("includes at least one cluster of close-together lines (a burst)", () => {
    // Spec §10.2 calls for "bursts of activity, quiet periods" — make
    // sure the curated cadence actually has at least one cluster of
    // ≤500ms gaps in a row, not all-uniform timing.
    const hasBurst = liveTailSeed.some(
      (entry, i, arr) =>
        i >= 2 &&
        arr[i - 1].delayMs <= 500 &&
        arr[i - 2].delayMs <= 500 &&
        entry.delayMs <= 500,
    );
    expect(hasBurst).toBe(true);
  });

  it("includes at least one quiet stretch (a pause)", () => {
    // And the inverse — at least one entry separated by a >=1500ms
    // pause from its predecessor.
    const hasPause = liveTailSeed.some((entry) => entry.delayMs >= 1500);
    expect(hasPause).toBe(true);
  });

  it("uses only declared instance ids and request ids", () => {
    const validInstances = new Set<string>(INSTANCES);
    const validRequestIds = new Set<string>(Object.keys(REQUEST_IDS));
    for (const entry of liveTailSeed) {
      expect(validInstances.has(entry.instance)).toBe(true);
      if (entry.requestId) {
        expect(validRequestIds.has(entry.requestId)).toBe(true);
      }
    }
  });
});
