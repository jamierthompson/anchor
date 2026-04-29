"use client";

import * as ScrollArea from "@radix-ui/react-scroll-area";
import { motion, type Transition } from "motion/react";
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from "react";

import type { FilterToggleTarget } from "@/lib/filter-state";
import type { DerivedLogLine } from "@/types/log";

import { LogLine } from "./log-line";
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
 * View Context don't add or remove children. The <li> animates between
 * height: 0 + opacity: 0 (hidden) and height: auto + opacity: 1
 * (visible), so DOM identity stays stable across visibility changes.
 *
 * Choreography per spec §6:
 *   Expand:   height grows first (~200ms), then text fades in (~150ms,
 *             with ~75ms delay). The line "makes room," then text
 *             materializes.
 *   Collapse: text fades out first (~150ms), then height collapses
 *             (~200ms, with ~100ms delay). Text dissolves, then the
 *             gap closes.
 *
 * The data attributes are still emitted so CSS can drive the dim and
 * selected-line accent states — those are CSS transitions, not Motion.
 */

// Spec §6 single easing curve. Mirrors --ease-standard in globals.css;
// duplicated here as a tuple because Motion takes the bezier control
// points directly rather than a CSS string.
const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Two transition modes:
 *
 *   - "instant" (filter dispatches): the height jumps to/from 0 with
 *     no transition. Opacity still fades over 150ms so there's
 *     visible "something is changing" feedback. Pairs with the live-
 *     tail stick-to-bottom in LogExplorer — the document size
 *     resolves immediately, the viewport follows. The list reads as
 *     "snappy" because the structural change happens at once.
 *
 *   - "slow" (context toggles): height eases over 200ms because the
 *     spatial expansion/contraction IS the point — the user opened a
 *     context window to see lines fluidly appear around their anchor.
 *     Heights ease the choreography of "this region is opening up."
 *
 * LogExplorer flips the mode per dispatch type. Filter dispatches set
 * "instant"; `handleToggleContext` sets "slow" for the duration of
 * the slow animation, then resets.
 */

const INSTANT_EXPAND: Transition = {
  height: { duration: 0 },
  opacity: { duration: 0 },
};

const INSTANT_COLLAPSE: Transition = {
  opacity: { duration: 0 },
  height: { duration: 0 },
};

const SLOW_EXPAND: Transition = {
  height: { duration: 0.2, ease: EASE },
  opacity: { duration: 0.15, delay: 0.075, ease: EASE },
};

const SLOW_COLLAPSE: Transition = {
  opacity: { duration: 0.15, ease: EASE },
  // Height eases over 200ms after opacity finishes (no overlap).
  height: { duration: 0.2, delay: 0.15, ease: EASE },
};

export function LogList({
  lines,
  viewportRef,
  onFilterToggle,
  onToggleContext,
  onLineFocus,
  onKeyDown,
  selectedLineIds,
  focusedLineId,
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
  onFilterToggle?: (target: FilterToggleTarget, sourceLineId: string) => void;
  onToggleContext?: (lineId: string) => void;
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
   * Set of line ids currently anchoring an open context — every
   * matching `<li>` gets the left-border accent and every matching
   * `LogLine` renders the anchor icon. A Set (rather than a single id
   * or array) lets us express multi-context selection cleanly and gives
   * O(1) per-row lookup as we walk the rendered array.
   */
  selectedLineIds?: ReadonlySet<string>;
  /**
   * Id of the line that should appear focused. Drives the
   * aria-activedescendant on the <ul> and the data-focused attribute
   * on the matching <li> (which CSS keys off for the outline).
   */
  focusedLineId?: string | null;
  /**
   * Animation mode for line height changes:
   *   - "instant" (default): height jumps to/from 0; opacity still fades.
   *     Used for filter dispatches — list resolves snappily.
   *   - "slow": height eases over 200ms. Used for context toggles
   *     where the spatial expansion IS the point.
   */
  transitionMode?: "instant" | "slow";
}) {
  const expand = transitionMode === "slow" ? SLOW_EXPAND : INSTANT_EXPAND;
  const collapse =
    transitionMode === "slow" ? SLOW_COLLAPSE : INSTANT_COLLAPSE;
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
          onKeyDown={onKeyDown}
        >
          {lines.map((line) => {
            // Lookup once per row, used twice — by the <li> for the
            // border accent and by the LogLine for the anchor icon.
            // Both surfaces stay in sync without a second source of
            // truth.
            const isSelected = selectedLineIds?.has(line.id) ?? false;
            const isFocused = line.id === focusedLineId;
            return (
              <motion.li
                key={line.id}
                id={lineDomId(line.id)}
                data-line-id={line.id}
                role="option"
                aria-selected={isSelected}
                className={styles.item}
                data-visible={line.isVisible}
                data-dimmed={line.isDimmed}
                data-selected={isSelected}
                data-focused={isFocused}
                // Plain click on the <li> sets focus on this line.
                // LogLine still owns the modifier-click (cmd/ctrl) for
                // context toggle and stops propagation on its inner
                // pill/badge buttons, so this only fires for non-button
                // clicks landing on the line body.
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey) return;
                  onLineFocus?.(line.id);
                }}
                // initial={false} so the page load doesn't animate every
                // line expanding from 0 — the first render uses the target
                // values directly. All subsequent isVisible toggles
                // animate.
                initial={false}
                animate={{
                  height: line.isVisible ? "auto" : 0,
                  opacity: line.isVisible ? 1 : 0,
                }}
                transition={line.isVisible ? expand : collapse}
              >
                <LogLine
                  line={line}
                  isDimmed={line.isDimmed}
                  isSelected={isSelected}
                  onFilterToggle={onFilterToggle}
                  onToggleContext={onToggleContext}
                />
              </motion.li>
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
