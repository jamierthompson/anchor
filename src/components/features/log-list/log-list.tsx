"use client";

import * as ScrollArea from "@radix-ui/react-scroll-area";
import { motion, type Transition } from "motion/react";
import type { Ref } from "react";

import type { FilterToggleTarget } from "@/lib/filter-state";
import type { DerivedLogLine } from "@/types/log";

import { LogLine } from "./log-line";
import styles from "./log-list.module.css";

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

const EXPAND_TRANSITION: Transition = {
  height: { duration: 0.2, ease: EASE },
  opacity: { duration: 0.15, delay: 0.075, ease: EASE },
};

const COLLAPSE_TRANSITION: Transition = {
  opacity: { duration: 0.15, ease: EASE },
  // Test: delay = opacity duration so heights only start collapsing
  // after items have fully faded out (no overlap).
  height: { duration: 0.2, delay: 0.15, ease: EASE },
};

export function LogList({
  lines,
  viewportRef,
  onFilterToggle,
  onToggleContext,
  selectedLineId,
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
  onFilterToggle?: (target: FilterToggleTarget) => void;
  onToggleContext?: (lineId: string) => void;
  /** Id of the line currently anchoring an open context — drives the left-border accent. */
  selectedLineId?: string;
}) {
  return (
    <ScrollArea.Root className={styles.scrollRoot} type="hover">
      <ScrollArea.Viewport
        ref={viewportRef}
        className={styles.scrollViewport}
      >
        <ul className={styles.list}>
          {lines.map((line) => (
            <motion.li
              key={line.id}
              data-line-id={line.id}
              className={styles.item}
              data-visible={line.isVisible}
              data-dimmed={line.isDimmed}
              data-selected={line.id === selectedLineId}
              // initial={false} so the page load doesn't animate every
              // line expanding from 0 — the first render uses the target
              // values directly. All subsequent isVisible toggles
              // animate.
              initial={false}
              animate={{
                height: line.isVisible ? "auto" : 0,
                opacity: line.isVisible ? 1 : 0,
              }}
              transition={
                line.isVisible ? EXPAND_TRANSITION : COLLAPSE_TRANSITION
              }
            >
              <LogLine
                line={line}
                isDimmed={line.isDimmed}
                onFilterToggle={onFilterToggle}
                onToggleContext={onToggleContext}
              />
            </motion.li>
          ))}
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
