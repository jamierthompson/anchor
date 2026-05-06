import { describe, expect, it } from "vitest";

import type { OpenContext } from "@/lib/context-state";
import { deriveLines } from "@/lib/derive-lines";
import { initialFilterState, type FilterState } from "@/lib/filter-state";
import type { Level, LogLine } from "@/types/log";

/**
 * Coverage for the unified visibility rule.
 *
 * The fixture below is a tiny, hand-crafted set rather than the real mock
 * data so each filter combination has a small, easily-counted expected
 * result. There are seven filtered states (combinations of the three
 * facets); each gets a test here, plus the no-filter case, the
 * OR-within-type case, an empty-intersection case, and the deploy-
 * boundary always-visible rule.
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

const visibleIds = (
  filter: FilterState,
  openContexts: readonly OpenContext[] = [],
): string[] =>
  deriveLines(FIXTURE, filter, openContexts)
    .filter((l) => l.isVisible)
    .map((l) => l.id);

const dimmedIds = (
  filter: FilterState,
  openContexts: readonly OpenContext[] = [],
): string[] =>
  deriveLines(FIXTURE, filter, openContexts)
    .filter((l) => l.isDimmed)
    .map((l) => l.id);

describe("deriveLines — the seven filtered states", () => {
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

  it("with no open contexts, no visible line is ever dimmed", () => {
    // Dimming requires a line revealed by a context window but not matched
    // by the filter. With no open contexts there's no reveal mechanism, so
    // every visible line is matched and therefore undimmed.
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

describe("deriveLines — context windows", () => {
  it("reveals lines within ±range of the selected line, dimmed if they don't match the filter", () => {
    // Filter to ERROR (matches L2, L4, L6). Open context on L4 with range
    // 1 — window covers indices 2, 3, 4 → L3, L4, L5.
    const filter = withFilter({ levels: ["ERROR"] });
    const contexts: OpenContext[] = [
      { selectedLineId: "L4", range: 1 },
    ];
    expect(visibleIds(filter, contexts)).toEqual([
      "L2",
      "L3",
      "L4",
      "L5",
      "L6",
      "DB",
    ]);
    expect(dimmedIds(filter, contexts)).toEqual(["L3", "L5"]);
  });

  it("a line that matches the filter stays undimmed even when also covered by a context window", () => {
    // Filter ERROR, context on L4 range 2 — window covers L2..L6. L2 and
    // L6 match the filter and must stay undimmed despite being in-window.
    const filter = withFilter({ levels: ["ERROR"] });
    const contexts: OpenContext[] = [
      { selectedLineId: "L4", range: 2 },
    ];
    const dimmed = dimmedIds(filter, contexts);
    expect(dimmed).not.toContain("L2");
    expect(dimmed).not.toContain("L6");
    expect(dimmed).toEqual(["L3", "L5"]);
  });

  it("collapses back when the selected line no longer matches the filter", () => {
    // Filter WARN — L4 (ERROR) doesn't match. The open context on L4
    // goes dormant: its surrounding lines collapse back to hidden, the
    // selected line itself is hidden by the filter, but the context
    // entry stays in state for the caller (we don't observe that here).
    const filter = withFilter({ levels: ["WARN"] });
    const contexts: OpenContext[] = [
      { selectedLineId: "L4", range: 2 },
    ];
    expect(visibleIds(filter, contexts)).toEqual(["L3", "DB"]);
    expect(dimmedIds(filter, contexts)).toEqual([]);
  });

  it("supports multiple overlapping context windows without compounding dim", () => {
    // Two contexts: L2 ±1 covers idx 0..2; L4 ±1 covers idx 2..4. Overlap
    // at L3 (idx 2). isDimmed is a boolean so coverage by multiple
    // windows doesn't change the outcome — L3 is still just dimmed.
    const filter = withFilter({ levels: ["ERROR"] });
    const contexts: OpenContext[] = [
      { selectedLineId: "L2", range: 1 },
      { selectedLineId: "L4", range: 1 },
    ];
    expect(visibleIds(filter, contexts)).toEqual([
      "L1",
      "L2",
      "L3",
      "L4",
      "L5",
      "L6",
      "DB",
    ]);
    expect(dimmedIds(filter, contexts)).toEqual(["L1", "L3", "L5"]);
  });

  it("deploy boundaries stay undimmed even when covered by a context window", () => {
    // DB sits at index 7. A context on L7 (idx 6) range 1 reaches DB at
    // idx 7. Deploy boundaries always render undimmed regardless.
    const filter = withFilter({ levels: ["ERROR"] });
    const contexts: OpenContext[] = [
      { selectedLineId: "L6", range: 2 },
    ];
    const derived = deriveLines(FIXTURE, filter, contexts);
    const db = derived.find((l) => l.id === "DB");
    expect(db?.isVisible).toBe(true);
    expect(db?.isDimmed).toBe(false);
  });

  it("ignores contexts whose selected line id is not in the input array", () => {
    // A stale context (e.g. line removed from a future variant) shouldn't
    // throw or affect visibility — it's silently dropped.
    const filter = withFilter({ levels: ["ERROR"] });
    const contexts: OpenContext[] = [
      { selectedLineId: "does-not-exist", range: 5 },
    ];
    expect(visibleIds(filter, contexts)).toEqual(["L2", "L4", "L6", "DB"]);
  });

  it("openContexts defaults to empty when omitted", () => {
    const withDefault = deriveLines(
      FIXTURE,
      withFilter({ levels: ["ERROR"] }),
    );
    const withExplicit = deriveLines(
      FIXTURE,
      withFilter({ levels: ["ERROR"] }),
      [],
    );
    expect(withDefault).toEqual(withExplicit);
  });
});
