import { describe, expect, it } from "vitest";

import { deriveLines } from "@/lib/derive-lines";
import { initialFilterState, type FilterState } from "@/lib/filter-state";
import type { Level, LogLine } from "@/types/log";

/**
 * Coverage for the unified visibility rule (spec §3).
 *
 * The fixture below is a tiny, hand-crafted set rather than the real mock
 * data so each filter combination has a small, easily-counted expected
 * result. Spec §3 enumerates seven filtered states; each gets a test
 * here, plus the no-filter case, the OR-within-type case, an empty-
 * intersection case, and the deploy-boundary always-visible rule (§5).
 *
 * Fixture layout — IDs are deliberately short so the assertions stay
 * readable:
 *
 *   L1: i1 / INFO  / —
 *   L2: i1 / ERROR / rA
 *   L3: i1 / WARN  / rA
 *   L4: i2 / ERROR / rB
 *   L5: i2 / INFO  / rB
 *   L6: i3 / ERROR / —
 *   L7: i3 / INFO  / —
 *   DB: deploy boundary
 */

const line = (
  id: string,
  instance: string,
  level: Level,
  requestId?: string,
): LogLine => ({
  id,
  timestamp: 0,
  instance,
  level,
  message: id,
  ...(requestId !== undefined && { requestId }),
});

const FIXTURE: readonly LogLine[] = [
  line("L1", "i1", "INFO"),
  line("L2", "i1", "ERROR", "rA"),
  line("L3", "i1", "WARN", "rA"),
  line("L4", "i2", "ERROR", "rB"),
  line("L5", "i2", "INFO", "rB"),
  line("L6", "i3", "ERROR"),
  line("L7", "i3", "INFO"),
  {
    id: "DB",
    timestamp: 0,
    instance: "i1",
    level: "INFO",
    message: "deploy",
    isDeployBoundary: true,
  },
];

const withFilter = (overrides: Partial<FilterState>): FilterState => ({
  ...initialFilterState,
  ...overrides,
});

const visibleIds = (filter: FilterState): string[] =>
  deriveLines(FIXTURE, filter)
    .filter((l) => l.isVisible)
    .map((l) => l.id);

describe("deriveLines — the seven filtered states (spec §3)", () => {
  it("with no filters, every line is visible", () => {
    expect(visibleIds(initialFilterState)).toEqual([
      "L1",
      "L2",
      "L3",
      "L4",
      "L5",
      "L6",
      "L7",
      "DB",
    ]);
  });

  it("instance only — shows lines from that instance plus the deploy boundary", () => {
    expect(visibleIds(withFilter({ instances: ["i1"] }))).toEqual([
      "L1",
      "L2",
      "L3",
      "DB",
    ]);
  });

  it("request id only — shows only lines tagged with that request id", () => {
    expect(visibleIds(withFilter({ requestIds: ["rA"] }))).toEqual([
      "L2",
      "L3",
      "DB",
    ]);
  });

  it("level only — shows lines at that level scattered across instances", () => {
    expect(visibleIds(withFilter({ levels: ["ERROR"] }))).toEqual([
      "L2",
      "L4",
      "L6",
      "DB",
    ]);
  });

  it("instance + request id — instance is redundant (request id implies instance)", () => {
    const withBoth = visibleIds(
      withFilter({ instances: ["i1"], requestIds: ["rA"] }),
    );
    const requestIdAlone = visibleIds(withFilter({ requestIds: ["rA"] }));
    expect(withBoth).toEqual(requestIdAlone);
  });

  it("instance + level — narrows to that level on that instance only", () => {
    expect(
      visibleIds(withFilter({ instances: ["i1"], levels: ["ERROR"] })),
    ).toEqual(["L2", "DB"]);
  });

  it("request id + level — narrows to that level on that request id", () => {
    expect(
      visibleIds(withFilter({ requestIds: ["rA"], levels: ["ERROR"] })),
    ).toEqual(["L2", "DB"]);
  });

  it("all three — same as request id + level since instance is redundant", () => {
    const withAll = visibleIds(
      withFilter({
        instances: ["i1"],
        requestIds: ["rA"],
        levels: ["ERROR"],
      }),
    );
    const requestIdAndLevel = visibleIds(
      withFilter({ requestIds: ["rA"], levels: ["ERROR"] }),
    );
    expect(withAll).toEqual(requestIdAndLevel);
  });
});

describe("deriveLines — within-facet OR vs across-facet AND", () => {
  it("two instances OR together within the facet", () => {
    expect(visibleIds(withFilter({ instances: ["i1", "i2"] }))).toEqual([
      "L1",
      "L2",
      "L3",
      "L4",
      "L5",
      "DB",
    ]);
  });

  it("instances OR-d, then AND-d with level — '(i1 OR i2) AND level=ERROR'", () => {
    expect(
      visibleIds(
        withFilter({ instances: ["i1", "i2"], levels: ["ERROR"] }),
      ),
    ).toEqual(["L2", "L4", "DB"]);
  });

  it("two levels OR together within the facet", () => {
    expect(visibleIds(withFilter({ levels: ["WARN", "ERROR"] }))).toEqual([
      "L2",
      "L3",
      "L4",
      "L6",
      "DB",
    ]);
  });
});

describe("deriveLines — edge cases", () => {
  it("a non-matching combination produces an empty result (deploy boundary aside)", () => {
    // rA is on instance i1; level=INFO doesn't appear for rA. Empty intersection.
    expect(
      visibleIds(withFilter({ requestIds: ["rA"], levels: ["INFO"] })),
    ).toEqual(["DB"]);
  });

  it("a request-id filter excludes lines that have no request id", () => {
    expect(visibleIds(withFilter({ requestIds: ["rA"] }))).not.toContain(
      "L1",
    );
    expect(visibleIds(withFilter({ requestIds: ["rA"] }))).not.toContain(
      "L6",
    );
  });

  it("deploy boundaries stay visible even when no other filter matches", () => {
    expect(
      visibleIds(withFilter({ instances: ["does-not-exist"] })),
    ).toEqual(["DB"]);
  });

  it("isDimmed is always false until context windows arrive in task #3", () => {
    const derived = deriveLines(
      FIXTURE,
      withFilter({ instances: ["i1"], levels: ["ERROR"] }),
    );
    expect(derived.every((l) => l.isDimmed === false)).toBe(true);
  });

  it("input array is not mutated", () => {
    const before = JSON.stringify(FIXTURE);
    deriveLines(FIXTURE, withFilter({ instances: ["i1"] }));
    expect(JSON.stringify(FIXTURE)).toBe(before);
  });
});
