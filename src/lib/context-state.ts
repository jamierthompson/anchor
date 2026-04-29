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
 * Range cycle for the shift+e shortcut (spec §7). The default range
 * is the first entry; pressing shift+e advances to the next, wrapping
 * back to the start after the last.
 *
 * Kept as a module-level constant (not a magic-number array inline)
 * so the cycle can be tested directly and so future tweaks (a kebab
 * "Context size" submenu in task #8, the global default control in
 * §9.4) read from the same source.
 */
export const CONTEXT_RANGE_CYCLE = [20, 50, 100] as const;

/**
 * Given the current range of an open context, return the next entry
 * in CONTEXT_RANGE_CYCLE. Falls back to the first entry if the
 * current range isn't on the cycle (e.g. set via a future custom-
 * size UI) — this avoids a "stuck" state where shift+e does nothing
 * because the current value isn't recognized.
 */
export function nextContextRange(current: number): number {
  const idx = CONTEXT_RANGE_CYCLE.indexOf(
    current as (typeof CONTEXT_RANGE_CYCLE)[number],
  );
  if (idx === -1) return CONTEXT_RANGE_CYCLE[0];
  return CONTEXT_RANGE_CYCLE[(idx + 1) % CONTEXT_RANGE_CYCLE.length];
}
