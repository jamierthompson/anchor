"use client";

import * as ScrollArea from "@radix-ui/react-scroll-area";
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from "react";

import type { DerivedLogLine } from "@/types/log";

import { LogListItem } from "./log-list-item";
import styles from "./log-list.module.css";

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
 * Choreography per spec §6 lives in log-list.module.css. The asymmetric
 * expand/collapse timing is encoded by attaching different transitions
 * to the two states. Two modes via `data-transition-mode` on this <ul>:
 *
 *   - "instant" (filter dispatches): grid track snaps; opacity snaps.
 *     The list reads as snappy — structural change happens at once.
 *   - "slow" (context toggles): grid track eases 200ms; opacity 150ms.
 *     The spatial expansion/contraction IS the point — heights ease
 *     the choreography of "this region is opening up."
 */

export function LogList({
  lines,
  viewportRef,
  onToggleContext,
  onCopyLine,
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
   * Ref to the Radix Scroll Area viewport. LogExplorer reads/writes
   * scrollTop on this ref for the anchor-mechanics compensation —
   * exposing it here keeps the viewport ownership inside LogList where
   * the JSX lives, and the parent gets read/write access by passing
   * its own ref through.
   */
  viewportRef?: Ref<HTMLDivElement>;
  onToggleContext?: (lineId: string) => void;
  /** Copies a plain-text representation of the line to the clipboard. */
  onCopyLine?: (lineId: string) => void;
  /**
   * Called with the line id when the user focuses a line via mouse
   * (plain click on the line body). The keyboard navigation path
   * (j/k/g/G/[ /]) sets focused state directly in LogExplorer — this
   * callback is the mouse equivalent.
   */
  onLineFocus?: (lineId: string) => void;
  /**
   * Keyboard handler attached to the <ul>. LogExplorer owns the
   * navigation logic (it has access to the derived lines and focus
   * state); LogList just wires the event source.
   */
  onKeyDown?: (event: ReactKeyboardEvent<HTMLUListElement>) => void;
  /**
   * Set of line ids that are currently anchoring an open context
   * window. Used to drive the selection accent (left-border + filled
   * Anchor button) on each row. A Set is enough now that range
   * expansion is keyboard-only — no per-line consumer needs the
   * actual ±N value (the legend reads it from the OpenContext array
   * in LogExplorer instead).
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
   * uses `@starting-style` to mount streamed rows from the collapsed
   * state so they animate in. Initial-fixture rows mount at final
   * values without animating — avoids 415 simultaneous mount-time
   * animations on page load.
   */
  streamedLineIds?: ReadonlySet<string>;
  /**
   * Whether at least one filter is currently active. Combined with
   * the per-line `isDimmed` flag (already on each derived line) this
   * is enough to decide whether the kebab's "View context" item
   * should render — the §3 gate is `hasAnyFilter && !isDimmed`.
   * Lifted to a prop so LogList doesn't need to know FilterState's
   * shape; LogExplorer pre-computes it once via `hasAnyFilter`.
   */
  hasAnyFilter?: boolean;
  /**
   * Animation mode for line height changes:
   *   - "instant" (default): grid track snaps; opacity snaps. Used
   *     for filter dispatches — list resolves snappily.
   *   - "slow": grid track eases 200ms; opacity 150ms. Used for
   *     context toggles where the spatial expansion IS the point.
   *
   * Surfaces on the <ul> as `data-transition-mode` and the CSS in
   * log-list.module.css keys per-row transitions off it.
   */
  transitionMode?: "instant" | "slow";
}) {
  return (
    <ScrollArea.Root className={styles.scrollRoot} type="hover">
      <ScrollArea.Viewport
        ref={viewportRef}
        className={styles.scrollViewport}
      >
        {/*
          The <ul> is the single Tab stop for keyboard nav. tabIndex={0}
          makes it focusable; role="listbox" + aria-activedescendant
          tells screen readers which line within the list is "active"
          even though DOM focus is on the <ul> itself. Keyboard handler
          lives in LogExplorer (it owns the derived-lines + focus state);
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
          {lines.map((line) => {
            // Per-row primitives derived from the (potentially-fresh-
            // every-render) Set references. Computing them here means
            // LogListItem receives stable boolean props and the
            // React.memo wrapping it actually bites on the cases where
            // it can — e.g., a tail tick that doesn't change THIS row's
            // data.
            const isSelected = selectedContextLineIds?.has(line.id) ?? false;
            const isFocused = line.id === focusedLineId;
            const isStreamed = streamedLineIds?.has(line.id) ?? false;
            // §3 gate for the View/Hide context toggle action. The Copy
            // action has its own (looser) gate — see LineActions; it
            // shows on any visible line.
            const canToggleContext =
              hasAnyFilter && line.isVisible && !line.isDimmed;
            return (
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
                onCopyLine={onCopyLine}
              />
            );
          })}
        </ul>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className={styles.scrollbar}
      >
        <ScrollArea.Thumb className={styles.scrollbarThumb} />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner className={styles.scrollCorner} />
    </ScrollArea.Root>
  );
}
