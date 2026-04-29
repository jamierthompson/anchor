import {
  Anchor,
  Copy,
  ListChevronsDownUp,
  ListChevronsUpDown,
} from "lucide-react";

import { CONTEXT_RANGE_CYCLE } from "@/lib/context-state";

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
 *   2. Expand context (ListChevronsUpDown) — only when isSelected AND
 *      the current range is below the cycle max. Hidden at ±100.
 *
 *   3. Less context (ListChevronsDownUp) — only when isSelected AND
 *      the current range is above the cycle min. Hidden at ±20.
 *
 *   4. Copy line — visible whenever the action row is visible. Copy
 *      is universally available (no §3 gate) so users can copy any
 *      visible line at any time, including dimmed (context-revealed
 *      but not filter-matching) lines and lines under no filter.
 *
 * The row itself is rendered when ANY action would appear — gated on
 * line visibility (hidden lines never need actions, height: 0 hides
 * them anyway) and the presence of `onCopyLine` (universal action,
 * always-on signal that something is interactable on this line) OR
 * the toggle-state gate.
 *
 * tabIndex={-1} on every button keeps Tab from walking the action row
 * line by line — keyboard equivalents (`e`, `shift+e`, `c`) cover the
 * primary actions; the buttons are mouse/pointer affordances.
 *
 * **Future refactor**: when more icon-button consumers exist (filter
 * chips, time-format toggle, density toggle), extract a shared
 * `<IconButton>` primitive into `components/ui/`. With one consumer
 * the abstraction is premature — the design API isn't stable yet.
 */
export function LineActions({
  lineId,
  isVisible,
  isSelected,
  canToggleContext,
  contextRange,
  onToggleContext,
  onExpandContext,
  onLessContext,
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
  contextRange: number;
  onToggleContext: (lineId: string) => void;
  onExpandContext?: (lineId: string) => void;
  onLessContext?: (lineId: string) => void;
  onCopyLine?: (lineId: string) => void;
}) {
  if (!isVisible) return null;

  // Show the row when at least one action would render. Copy is the
  // universal action; if onCopyLine is provided the row always
  // renders. Otherwise the toggle/anchor gates determine it.
  const showAnchorButton = canToggleContext || isSelected;
  const showRow = showAnchorButton || !!onCopyLine;
  if (!showRow) return null;

  const minRange = CONTEXT_RANGE_CYCLE[0];
  const maxRange = CONTEXT_RANGE_CYCLE[CONTEXT_RANGE_CYCLE.length - 1];

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
      {isSelected && contextRange < maxRange && onExpandContext ? (
        <button
          type="button"
          className={styles.actionButton}
          tabIndex={-1}
          aria-label="Expand context"
          onClick={(event) => {
            event.stopPropagation();
            onExpandContext(lineId);
          }}
        >
          <ListChevronsUpDown aria-hidden="true" size={14} />
        </button>
      ) : null}
      {isSelected && contextRange > minRange && onLessContext ? (
        <button
          type="button"
          className={styles.actionButton}
          tabIndex={-1}
          aria-label="Less context"
          onClick={(event) => {
            event.stopPropagation();
            onLessContext(lineId);
          }}
        >
          <ListChevronsDownUp aria-hidden="true" size={14} />
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
