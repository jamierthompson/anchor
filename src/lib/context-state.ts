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
