"use client";

import { memo, type MouseEvent as ReactMouseEvent } from "react";

import type { DerivedLogLine } from "@/types/log";

import { LogLine } from "./log-line";
import styles from "./log-list.module.css";

/**
 * Single row of the log list. Plain <li> + .inner wrapper — height
 * and opacity are interpolated by CSS using the grid-track-fr trick
 * so React re-renders can't perturb an in-flight transition.
 *
 * The memo is defense-in-depth against wasted reconciliation work on
 * tail ticks; CSS already owns the visual tween, so memoization is
 * a perf nicety, not a correctness requirement.
 *
 * Equality compares id + isVisible + isDimmed because the source
 * line type is fully readonly — any meaningful change must surface
 * as a derived-flag change on a line sharing the same id.
 */

type LogListItemProps = {
  line: DerivedLogLine;
  domId: string;
  /**
   * True only for lines that streamed in via live tail. Drives
   * `data-streamed` on the <li>; the CSS keys an entrance animation
   * off this attribute so streamed rows mount from the collapsed
   * state. Initial-fixture rows mount at final values without
   * animating — avoids all initial-fixture lines animating
   * simultaneously on page load.
   */
  isStreamed: boolean;
  isSelected: boolean;
  isFocused: boolean;
  /**
   * Gate for the View/Hide context action (filter active +
   * filter-matched + not dimmed). Pre-resolved by the parent so this
   * row doesn't need to know the filter state's shape.
   */
  canToggleContext: boolean;
  onLineFocus?: (lineId: string) => void;
  onToggleContext?: (lineId: string) => void;
};

function LogListItemImpl({
  line,
  domId,
  isStreamed,
  isSelected,
  isFocused,
  canToggleContext,
  onLineFocus,
  onToggleContext,
}: LogListItemProps) {
  // Plain click on the <li> drives the unified line interaction:
  //   - If the line is currently the anchor of an open context, click
  //     closes that context (matches the keyboard toggle binding).
  //   - Else if the toggle-context gate passes (filter active +
  //     filter-matched + not dimmed), click opens a context.
  //   - Otherwise click only moves focus — the line is still
  //     keyboard-navigable but has no context to anchor.
  //
  // In all cases focus moves to the clicked line so subsequent
  // keyboard navigation starts from where the user just was. Modifier
  // keys (cmd/ctrl/alt) are ignored so platform shortcuts pass
  // through unaffected.
  const handleClick = (event: ReactMouseEvent<HTMLLIElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    onLineFocus?.(line.id);
    if (isSelected || canToggleContext) {
      onToggleContext?.(line.id);
    }
  };

  // Lines that participate in the click-to-toggle interaction get a
  // pointer cursor and a hover surface. Deploy boundaries and lines
  // that fail every gate stay as plain rows — clicking them only
  // moves focus, which is a quiet enough action that pointer affordance
  // would mislead the user into expecting more.
  const isClickable = !line.isDeployBoundary && (isSelected || canToggleContext);

  return (
    <li
      id={domId}
      data-line-id={line.id}
      role="option"
      aria-selected={isSelected}
      className={styles.item}
      data-visible={line.isVisible}
      data-dimmed={line.isDimmed}
      data-selected={isSelected}
      data-focused={isFocused}
      data-streamed={isStreamed}
      data-clickable={isClickable}
      onClick={handleClick}
    >
      <div className={styles.inner}>
        <LogLine
          line={line}
          isVisible={line.isVisible}
          isDimmed={line.isDimmed}
          isSelected={isSelected}
          canToggleContext={canToggleContext}
          onToggleContext={onToggleContext}
        />
      </div>
    </li>
  );
}

/**
 * Custom equality for the memo. See file-level docblock for why a
 * narrow comparison is sufficient given the immutability of the
 * underlying line source.
 */
function arePropsEqual(prev: LogListItemProps, next: LogListItemProps) {
  return (
    prev.line.id === next.line.id &&
    prev.line.isVisible === next.line.isVisible &&
    prev.line.isDimmed === next.line.isDimmed &&
    prev.domId === next.domId &&
    prev.isStreamed === next.isStreamed &&
    prev.isSelected === next.isSelected &&
    prev.isFocused === next.isFocused &&
    prev.canToggleContext === next.canToggleContext &&
    prev.onLineFocus === next.onLineFocus &&
    prev.onToggleContext === next.onToggleContext
  );
}

export const LogListItem = memo(LogListItemImpl, arePropsEqual);
