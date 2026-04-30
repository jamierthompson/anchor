/**
 * Open View Context windows.
 *
 * An open context anchors on a single line (`selectedLineId`) and
 * reveals the ±`range` lines around it. Each entry corresponds to one
 * "View context" activation by the user.
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
 * Fixed step size for the shift+e expansion shortcut. Each press adds
 * this many lines to either side of the most-recently-opened context's
 * range, until the window covers all surrounding lines (`nextRange`
 * returns `null` at that point).
 *
 * Why fixed steps instead of a [20, 50, 100] cycle: cycling has no
 * visible state — the user can't see which step they're on, and there's
 * no signal when wrapping back to ±20. A predictable "+20 each press
 * until you can't go further" model avoids both problems and matches
 * the natural reading flow of "I need a bit more, hit the key again."
 */
export const CONTEXT_RANGE_STEP = 20;

/**
 * Compute the next range value when shift+e is pressed on a context
 * anchored at `anchorIndex` within a list of `totalLines`. Returns the
 * incremented range, or `null` if the current range already covers all
 * lines on both sides of the anchor (the boundary signal — the legend
 * uses this null to swap its hint to "no more context to expand").
 *
 * The bound is the maximum distance from the anchor to either edge of
 * the list. Once `currentRange` reaches that, growing further would
 * reveal no new lines on either side, so we treat it as the cap.
 */
export function nextRangeWithinBounds(
  anchorIndex: number,
  currentRange: number,
  totalLines: number,
): number | null {
  if (anchorIndex < 0 || anchorIndex >= totalLines) return null;
  const maxDistance = Math.max(anchorIndex, totalLines - 1 - anchorIndex);
  if (currentRange >= maxDistance) return null;
  return Math.min(currentRange + CONTEXT_RANGE_STEP, maxDistance);
}
