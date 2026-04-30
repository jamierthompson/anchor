import { Anchor, Copy } from "lucide-react";

import styles from "./log-line.module.css";

/**
 * Hover-revealed row of icon buttons at the right edge of a log line
 * (spec §8 — redesigned from the originally-planned kebab menu).
 *
 * Why no kebab: Radix DropdownMenu mounted per line tanked dev-mode
 * anchor compensation — every menu close batched its Root unmount +
 * Portal teardown into the same React commit as the context-toggle
 * state change, delaying the first paint past several frames during
 * which the anchor line was visibly displaced. Direct icon buttons are
 * plain `<button>` elements with no portal, no open state, no focus
 * management — click does the thing, in one frame.
 *
 * Action gates:
 *
 *   1. Anchor — "View context" / "Hide context" toggle. Visible when
 *      `canToggleContext` (the §3 gate: filter active + line filter-
 *      matched + visible + not dimmed) OR when a context is already
 *      open (so the user can always close one). aria-label and
 *      data-active flip on isSelected; CSS keys off data-active for
 *      the filled-accent style.
 *
 *   2. Copy line — visible whenever the action row is visible. Copy
 *      is universally available (no §3 gate) so users can copy any
 *      visible line at any time, including dimmed (context-revealed
 *      but not filter-matching) lines and lines under no filter.
 *
 * Range expansion (the old Expand / Less buttons) is keyboard-only
 * via shift+e — see `LogExplorer`'s key handler. The mouse buttons
 * were removed because expanding context naturally pulls the user's
 * scroll position away from the anchor line, and they shouldn't have
 * to scroll back to find an in-row button to expand again. shift+e
 * works wherever focus is.
 *
 * tabIndex={-1} on every button keeps Tab from walking the action row
 * line by line — keyboard equivalents (`e`, `c`) cover the actions;
 * the buttons are mouse/pointer affordances.
 */
export function LineActions({
  lineId,
  isVisible,
  isSelected,
  canToggleContext,
  onToggleContext,
  onCopyLine,
}: {
  lineId: string;
  /**
   * Whether this line is currently rendered (vs collapsed by Motion
   * to height: 0). The action row never renders for hidden lines —
   * they're invisible and rendering buttons for them is wasted React
   * reconciliation work across all 415 lines.
   */
  isVisible: boolean;
  isSelected: boolean;
  canToggleContext: boolean;
  onToggleContext: (lineId: string) => void;
  onCopyLine?: (lineId: string) => void;
}) {
  if (!isVisible) return null;

  // Show the row when at least one action would render. Copy is the
  // universal action; if onCopyLine is provided the row always
  // renders. Otherwise the toggle/anchor gates determine it.
  const showAnchorButton = canToggleContext || isSelected;
  const showRow = showAnchorButton || !!onCopyLine;
  if (!showRow) return null;

  return (
    <div className={styles.actionRow}>
      {showAnchorButton ? (
        <button
          type="button"
          className={styles.actionButton}
          // data-active drives a filled accent style in the CSS —
          // visual confirmation that this line is currently the anchor
          // of an open context, in addition to the left-border accent
          // on the <li>. Only set when isSelected is true.
          data-active={isSelected ? "true" : undefined}
          tabIndex={-1}
          aria-label={isSelected ? "Hide context" : "View context"}
          aria-pressed={isSelected}
          onClick={(event) => {
            event.stopPropagation();
            onToggleContext(lineId);
          }}
        >
          <Anchor aria-hidden="true" size={14} />
        </button>
      ) : null}
      {onCopyLine ? (
        <button
          type="button"
          className={styles.actionButton}
          tabIndex={-1}
          aria-label="Copy line"
          onClick={(event) => {
            event.stopPropagation();
            onCopyLine(lineId);
          }}
        >
          <Copy aria-hidden="true" size={14} />
        </button>
      ) : null}
    </div>
  );
}
