/**
 * Open View Context windows.
 *
 * An open context anchors on a single line (`selectedLineId`) and
 * reveals the ±`range` lines around it. Each entry corresponds to one
 * "View context" activation by the user.
 *
 * Task #3 (this commit) only ever produces zero or one open context.
 * The shape is an array because the unified rule already supports
 * multiple windows, so making the type collection-shaped now means
 * task #6 (multi-context overlap) just changes the toggle behavior
 * rather than the data model.
 */
export type OpenContext = {
  /** The id of the line the context is anchored on. */
  readonly selectedLineId: string;
  /** ±N lines around the selected line that the window covers. */
  readonly range: number;
};

/** Default ±N when activating View Context (spec §4). */
export const DEFAULT_CONTEXT_RANGE = 20;

/**
 * Range cycle (spec §7). The default range is the first entry. The
 * shift+e keyboard shortcut advances forward (wrapping ±100 → ±20).
 * The hover-row "Expand context" / "Less context" icon buttons step
 * forward and backward respectively without wrapping (the buttons
 * hide at the cycle endpoints — see LineActions in log-line.tsx).
 *
 * Kept as a module-level constant (not magic numbers inline) so the
 * cycle can be tested directly and so future tweaks (the global
 * default control in spec §9.4) read from the same source.
 */
export const CONTEXT_RANGE_CYCLE = [20, 50, 100] as const;

/**
 * Given the current range of an open context, return the next entry
 * in CONTEXT_RANGE_CYCLE. Wraps from ±100 → ±20 — the keyboard
 * shortcut treats the cycle as circular. Falls back to the first
 * entry if the current range isn't on the cycle (defensive against
 * a future custom-size UI setting an off-cycle value).
 */
export function nextContextRange(current: number): number {
  const idx = CONTEXT_RANGE_CYCLE.indexOf(
    current as (typeof CONTEXT_RANGE_CYCLE)[number],
  );
  if (idx === -1) return CONTEXT_RANGE_CYCLE[0];
  return CONTEXT_RANGE_CYCLE[(idx + 1) % CONTEXT_RANGE_CYCLE.length];
}

/**
 * Step the cycle backward without wrapping. Returns the same value
 * (a clamp at ±20) if already at the smallest. The icon-row "Less
 * context" button hides itself at the minimum, so this should
 * effectively never be called at the smallest size — the clamp is
 * defensive.
 */
export function previousContextRange(current: number): number {
  const idx = CONTEXT_RANGE_CYCLE.indexOf(
    current as (typeof CONTEXT_RANGE_CYCLE)[number],
  );
  if (idx <= 0) return CONTEXT_RANGE_CYCLE[0];
  return CONTEXT_RANGE_CYCLE[idx - 1];
}
