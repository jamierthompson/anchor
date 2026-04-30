import { describe, expect, it } from "vitest";

import { CONTEXT_RANGE_STEP, DEFAULT_CONTEXT_RANGE } from "@/lib/context-state";

/**
 * The interesting context-expansion math (the "can we add a step on
 * both sides?" boundary check) lives in LogExplorer rather than
 * here, because it depends on filter state. Integration coverage in
 * log-explorer.test.tsx exercises the boundary directly.
 *
 * What stays here is the small invariant about the step size — the
 * UX argument for "each press adds the same chunk you started with"
 * rests on these two constants matching.
 */

describe("CONTEXT_RANGE_STEP", () => {
  it("equals DEFAULT_CONTEXT_RANGE so the first press doubles the window", () => {
    expect(CONTEXT_RANGE_STEP).toBe(DEFAULT_CONTEXT_RANGE);
  });
});
