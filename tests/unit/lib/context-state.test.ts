import { describe, expect, it } from "vitest";

import {
  CONTEXT_RANGE_CYCLE,
  DEFAULT_CONTEXT_RANGE,
  nextContextRange,
  previousContextRange,
} from "@/lib/context-state";

/**
 * Pure-function coverage for the shift+e cycle helper. The integration
 * coverage (the keyboard binding actually advancing an open context's
 * range) lives in log-explorer.test.tsx; this file pins the cycle
 * contract itself so a future change to the cycle list (e.g. adding
 * ±200) lands a single test edit rather than ripple through the
 * integration tests.
 */

describe("nextContextRange — shift+e cycle helper", () => {
  it("starts the cycle at DEFAULT_CONTEXT_RANGE", () => {
    expect(CONTEXT_RANGE_CYCLE[0]).toBe(DEFAULT_CONTEXT_RANGE);
  });

  it("advances 20 → 50", () => {
    expect(nextContextRange(20)).toBe(50);
  });

  it("advances 50 → 100", () => {
    expect(nextContextRange(50)).toBe(100);
  });

  it("wraps 100 → 20", () => {
    expect(nextContextRange(100)).toBe(20);
  });

  it("falls back to the first cycle entry when the current range isn't on the cycle", () => {
    // Defensive: if a future custom-size UI sets an off-cycle value
    // (say ±35), shift+e shouldn't dead-end. The first cycle entry is
    // the safest "reset to known state" fallback.
    expect(nextContextRange(35)).toBe(20);
    expect(nextContextRange(0)).toBe(20);
    expect(nextContextRange(999)).toBe(20);
  });
});

describe("previousContextRange — Less context icon-button helper", () => {
  it("steps 100 → 50", () => {
    expect(previousContextRange(100)).toBe(50);
  });

  it("steps 50 → 20", () => {
    expect(previousContextRange(50)).toBe(20);
  });

  it("clamps at 20 (the icon button is hidden at min, but defensive)", () => {
    expect(previousContextRange(20)).toBe(20);
  });

  it("falls back to the first cycle entry for off-cycle values", () => {
    expect(previousContextRange(35)).toBe(20);
    expect(previousContextRange(0)).toBe(20);
  });
});
