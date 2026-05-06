"use client";

import * as ScrollArea from "@radix-ui/react-scroll-area";
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from "react";

import type { DerivedLogLine } from "@/types/log";

import { DateBoundary } from "./date-boundary";
import { LogListItem } from "./log-list-item";
import styles from "./log-list.module.css";

/*
 * UTC date key for a timestamp ("YYYY-MM-DD", just a string the
 * date-transition walk compares for equality). UTC so the rendered
 * boundary aligns with the deterministic UTC times the rest of the
 * fixture uses.
 */
function getUtcDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/**
 * DOM id prefix for each <li>. The <ul> uses
 * `aria-activedescendant="line_<focusedLineId>"` to point screen
 * readers at the visually focused line, so each <li> needs a stable
 * id formed by this prefix + the line id. Kept as a single constant
 * so the read and write sides stay in sync.
 */
const LINE_DOM_ID_PREFIX = "line_";
const lineDomId = (lineId: string) => `${LINE_DOM_ID_PREFIX}${lineId}`;

/**
 * Renders a sequence of log lines.
 *
 * Uses <ul>/<li> to convey the sequence-and-identity semantics of a
 * log feed. The list is always the full fixed array — filtering and
 * View Context don't add or remove children. Each <li> animates between
 * a `data-visible="false"` state (grid-template-rows: 0fr, opacity 0)
 * and `data-visible="true"` (grid-template-rows: 1fr, opacity 1), so
 * DOM identity stays stable across visibility changes.
 *
 * Choreography lives in the sibling stylesheet. The asymmetric
 * expand/collapse timing is encoded by attaching different transitions
 * to the two states. Two modes via `data-transition-mode` on this <ul>:
 *
 *   - "instant" (filter dispatches): grid track snaps; opacity snaps.
 *     The list reads as snappy — structural change happens at once.
 *   - "slow" (context toggles): grid track eases over the slow-
 *     transition duration with opacity easing slightly faster — the
 *     spatial expansion IS the point.
 */

export function LogList({
  lines,
  viewportRef,
  onToggleContext,
  onLineFocus,
  onKeyDown,
  selectedContextLineIds,
  focusedLineId,
  streamedLineIds,
  hasAnyFilter = false,
  transitionMode = "instant",
}: {
  lines: readonly DerivedLogLine[];
  /**
   * Ref to the scroll viewport. The parent reads/writes scrollTop for
   * the anchor-mechanics compensation; exposing it here keeps viewport
   * ownership where the JSX lives.
   */
  viewportRef?: Ref<HTMLDivElement>;
  onToggleContext?: (lineId: string) => void;
  /**
   * Called with the line id when the user focuses a line via mouse
   * (plain click on the line body). The keyboard navigation path
   * sets focused state directly in the parent — this callback is the
   * mouse equivalent.
   */
  onLineFocus?: (lineId: string) => void;
  /**
   * Keyboard handler attached to the <ul>. The parent owns the
   * navigation logic (it has access to the derived lines and focus
   * state); this component just wires the event source.
   */
  onKeyDown?: (event: ReactKeyboardEvent<HTMLUListElement>) => void;
  /**
   * Set of line ids that are currently anchoring an open context
   * window. Drives the selection accent (left-border) on each row.
   * A Set is enough because no per-line consumer needs the actual
   * range value — only the parent's hint surface uses it, and that
   * reads from the OpenContext array directly.
   */
  selectedContextLineIds?: ReadonlySet<string>;
  /**
   * Id of the line that should appear focused. Drives the
   * aria-activedescendant on the <ul> and the data-focused attribute
   * on the matching <li> (which CSS keys off for the outline).
   */
  focusedLineId?: string | null;
  /**
   * Ids of lines that streamed in via live tail (i.e. not present at
   * component mount). Drives `data-streamed` on the <li>; the CSS
   * keys an entrance animation off this attribute so newly-streamed
   * rows mount from the collapsed state. Initial-fixture rows mount
   * at final values without animating — avoids every fixture line
   * animating simultaneously on page load.
   */
  streamedLineIds?: ReadonlySet<string>;
  /**
   * Whether at least one filter is currently active. Combined with
   * the per-line `isDimmed` flag (already on each derived line) this
   * is enough to decide whether a row participates in the click-to-
   * toggle context interaction. Lifted to a prop so this component
   * doesn't need to know the filter state's shape; the parent pre-
   * computes it once.
   */
  hasAnyFilter?: boolean;
  /**
   * Animation mode for line height changes:
   *   - "instant" (default): grid track snaps; opacity snaps. Used
   *     for filter dispatches — list resolves snappily.
   *   - "slow": grid track eases over the slow-transition duration
   *     with opacity easing slightly faster. Used for context toggles
   *     where the spatial expansion IS the point.
   *
   * Surfaces on the <ul> as `data-transition-mode`; the sibling
   * stylesheet keys per-row transitions off it.
   */
  transitionMode?: "instant" | "slow";
}) {
  return (
    <ScrollArea.Root className={styles.scrollRoot} type="hover">
      <ScrollArea.Viewport ref={viewportRef} className={styles.scrollViewport}>
        {/*
          The <ul> is the single Tab stop for keyboard nav. tabIndex={0}
          makes it focusable; role="listbox" + aria-activedescendant
          tells screen readers which line within the list is "active"
          even though DOM focus is on the <ul> itself. Keyboard handler
          lives in the parent (it owns the derived-lines + focus state);
          this is just the event source.
        */}
        <ul
          className={styles.list}
          role="listbox"
          tabIndex={0}
          aria-label="Log lines"
          aria-activedescendant={
            focusedLineId ? lineDomId(focusedLineId) : undefined
          }
          data-transition-mode={transitionMode}
          onKeyDown={onKeyDown}
        >
          {(() => {
            // Walk the lines and interleave a <DateBoundary> before the
            // first line of each calendar day. The boundary is wrapped
            // in an <li role="presentation"> so the listbox semantics
            // (Tab + aria-activedescendant on visible lines) stay
            // intact while the markup remains valid <ul>/<li>.
            let lastDateKey: string | null = null;
            const items: React.ReactNode[] = [];
            for (const line of lines) {
              const dateKey = getUtcDateKey(line.timestamp);
              if (dateKey !== lastDateKey) {
                items.push(
                  <li
                    key={`date_${dateKey}`}
                    role="presentation"
                    className={styles.dateBoundaryItem}
                  >
                    <DateBoundary timestamp={line.timestamp} />
                  </li>,
                );
                lastDateKey = dateKey;
              }
              const isSelected = selectedContextLineIds?.has(line.id) ?? false;
              const isFocused = line.id === focusedLineId;
              const isStreamed = streamedLineIds?.has(line.id) ?? false;
              // Gate for the View/Hide context toggle action.
              const canToggleContext =
                hasAnyFilter && line.isVisible && !line.isDimmed;
              items.push(
                <LogListItem
                  key={line.id}
                  line={line}
                  domId={lineDomId(line.id)}
                  isStreamed={isStreamed}
                  isSelected={isSelected}
                  isFocused={isFocused}
                  canToggleContext={canToggleContext}
                  onLineFocus={onLineFocus}
                  onToggleContext={onToggleContext}
                />,
              );
            }
            return items;
          })()}
        </ul>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" className={styles.scrollbar}>
        <ScrollArea.Thumb className={styles.scrollbarThumb} />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner className={styles.scrollCorner} />
    </ScrollArea.Root>
  );
}
