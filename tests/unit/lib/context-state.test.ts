import { describe, expect, it } from "vitest";

import {
  CONTEXT_RANGE_STEP,
  DEFAULT_CONTEXT_RANGE,
  nextRangeWithinBounds,
} from "@/lib/context-state";

/**
 * Pure-function coverage for the shift+e expansion helper. The
 * integration coverage (the keyboard binding actually growing an open
 * context's range and the legend swapping at the file boundary) lives
 * in log-explorer.test.tsx; this file pins the math itself so changes
 * to step size or boundary semantics land a single test edit.
 */

describe("CONTEXT_RANGE_STEP", () => {
  it("equals DEFAULT_CONTEXT_RANGE so the first press doubles the window", () => {
    // Why pin this: the UX argument for a fixed step rests on "each
    // press adds the same chunk you started with." Decoupling the two
    // would silently break that promise.
    expect(CONTEXT_RANGE_STEP).toBe(DEFAULT_CONTEXT_RANGE);
  });
});

describe("nextRangeWithinBounds — shift+e expansion helper", () => {
  it("adds CONTEXT_RANGE_STEP when the next range still fits within the anchor's reach", () => {
    // Anchor at index 25 of 51 lines: max distance to either edge is
    // 25. From ±20, +20 would overshoot to 40, so we clamp at 25.
    expect(nextRangeWithinBounds(25, 20, 51)).toBe(25);
  });

  it("adds the full step when the anchor has plenty of headroom on both sides", () => {
    // Anchor at index 50 of 200 lines: max distance is 149. From ±20,
    // +20 lands at 40 — well under the cap.
    expect(nextRangeWithinBounds(50, 20, 200)).toBe(40);
  });

  it("returns null when the current range already reaches the farther edge", () => {
    // Anchor at index 25 of 51 lines: max distance 25. ±25 already
    // covers everything, so shift+e has nowhere to go.
    expect(nextRangeWithinBounds(25, 25, 51)).toBeNull();
    expect(nextRangeWithinBounds(25, 30, 51)).toBeNull();
  });

  it("returns null for an out-of-bounds anchor index (defensive)", () => {
    // The caller looks up anchors by line id; if an id stops resolving
    // we don't want shift+e to grow a window for a line that no longer
    // exists in the rendered set.
    expect(nextRangeWithinBounds(-1, 20, 51)).toBeNull();
    expect(nextRangeWithinBounds(51, 20, 51)).toBeNull();
  });

  it("uses the larger of the two side distances when anchor is off-center", () => {
    // Anchor at index 5 of 100: distance to start is 5, to end is 94.
    // We use the LARGER (94) — once the window covers the short side
    // it can still grow on the long side, so expansion isn't capped
    // until both sides are reached.
    expect(nextRangeWithinBounds(5, 20, 100)).toBe(40);
    expect(nextRangeWithinBounds(5, 90, 100)).toBe(94);
    expect(nextRangeWithinBounds(5, 94, 100)).toBeNull();
  });
});
