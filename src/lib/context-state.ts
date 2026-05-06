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

/** Default ±N when activating View Context. */
export const DEFAULT_CONTEXT_RANGE = 20;

/**
 * Fixed step added to either side of the most-recently-opened context
 * per expansion press, until the window covers everything between the
 * anchor and both file edges (see `isAtFileBoundary`).
 *
 * Why fixed steps over a cycling progression: cycling has no visible
 * state — the user can't see which step they're on, and there's no
 * signal when wrapping. Predictable additive growth matches the
 * natural reading flow of "a bit more, hit the key again."
 */
export const CONTEXT_RANGE_STEP = 20;

/**
 * Whether the context window already covers the loaded data on both
 * sides of the anchor. Once true, the expansion binding becomes a
 * no-op and the surrounding chrome reflects that no growth path
 * remains.
 *
 * The bound is the *longer* side — `Math.max(anchorIndex, totalLines
 * - 1 - anchorIndex)`. Range grows symmetrically; once it meets that
 * larger distance, both sides are exhausted (the shorter side hit
 * its edge first and clamped, the longer side just reached its
 * edge). We wait for both ends rather than stopping at the first
 * exhausted side: the user might be reading on the side that still
 * has content even if the other side is done.
 *
 * In real logs this rule terminates because the data is paginated —
 * `totalLines` is the loaded chunk, not the entire log file. In this
 * prototype the whole mock fixture loads at once, which is the same
 * shape of bound from the math's perspective.
 */
export function isAtFileBoundary(
  anchorIndex: number,
  currentRange: number,
  totalLines: number,
): boolean {
  if (anchorIndex < 0 || anchorIndex >= totalLines) return true;
  const maxDistance = Math.max(anchorIndex, totalLines - 1 - anchorIndex);
  return currentRange >= maxDistance;
}

