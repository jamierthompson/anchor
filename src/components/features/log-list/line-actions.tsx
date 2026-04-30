import { Anchor } from "lucide-react";

import styles from "./log-line.module.css";

/**
 * Hover-revealed row at the right edge of a log line.
 *
 * Currently a single anchor button — "View context" / "Hide context"
 * toggle. Visible when `canToggleContext` (the §3 gate: filter active +
 * line filter-matched + visible + not dimmed) OR when a context is
 * already open (so the user can always close one). aria-label and
 * data-active flip on isSelected; CSS keys off data-active for the
 * filled-accent style.
 *
 * Range expansion is keyboard-only via shift+e — see `LogExplorer`'s
 * key handler. Mouse buttons for expansion would naturally pull the
 * user's scroll position away from the anchor; the keyboard binding
 * works wherever focus is.
 *
 * tabIndex={-1} keeps Tab from walking the action row line by line —
 * the keyboard equivalent (`e`) covers the action; the button is the
 * mouse/pointer affordance.
 */
export function LineActions({
  lineId,
  isVisible,
  isSelected,
  canToggleContext,
  onToggleContext,
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
}) {
  if (!isVisible) return null;

  const showAnchorButton = canToggleContext || isSelected;
  if (!showAnchorButton) return null;

  return (
    <div className={styles.actionRow}>
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
    </div>
  );
}
