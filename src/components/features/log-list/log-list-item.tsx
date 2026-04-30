"use client";

import { memo, type MouseEvent as ReactMouseEvent } from "react";

import type { DerivedLogLine } from "@/types/log";

import { LogLine } from "./log-line";
import styles from "./log-list.module.css";

/**
 * Single row of the log list. Plain <li> + .inner wrapper — height /
 * opacity are interpolated by CSS (the grid-template-rows trick; see
 * log-list.module.css for the full rationale).
 *
 * ### Why CSS, not Motion
 *
 * Motion ran the height/opacity tween in JS, driven by React's render
 * cycle — and any re-render that touched a `motion.li` could perturb
 * an in-flight tween if Motion saw a new `animate` object identity.
 * Closing a context window while live tail was active reliably
 * produced visible stutter because the callback identities (and
 * therefore the row's prop identities) churned mid-animation.
 *
 * CSS transitions are owned by the browser engine. Once a transition
 * starts on a property, no React re-render can affect it. Memoization
 * becomes a perf nicety, not a correctness requirement; the close
 * choreography runs end-to-end without interruption regardless of
 * what happens in React land.
 *
 * The memo here stays as defense-in-depth — it cuts wasted
 * reconciliation work on tail ticks where this row's data is
 * unchanged — but it's no longer load-bearing for visual smoothness.
 *
 * ### Memo equality
 *
 * `deriveLines` rebuilds every `DerivedLogLine` on each call, so the
 * default shallow `prevProps.line === nextProps.line` would always
 * fail. The underlying `LogLine` is fully `readonly` (src/types/log.ts),
 * so the only fields that can differ between two `DerivedLogLine`s
 * sharing an `id` are the derived flags `isVisible` / `isDimmed`.
 * Comparing those three is a sound proxy for "this row's data didn't
 * change."
 */

type LogListItemProps = {
  line: DerivedLogLine;
  domId: string;
  /**
   * True only for lines that streamed in via live tail. Drives
   * `data-streamed` on the <li>; the CSS uses `@starting-style` to
   * mount streamed rows at { 0fr, opacity 0 } so they animate in.
   * Initial-fixture rows (data-streamed="false") mount at final
   * values without animating — avoids 415 simultaneous mount-time
   * animations on page load.
   */
  isStreamed: boolean;
  isSelected: boolean;
  isFocused: boolean;
  /**
   * §3 gate for the View/Hide context action. Pre-resolved in LogList
   * so this row doesn't need FilterState shape.
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
  //     closes that context (matches the keyboard `e` toggle).
  //   - Else if the §3 gate passes (filter active + filter-matched +
  //     not dimmed), click opens a context.
  //   - Otherwise click only moves focus — the line is still
  //     keyboard-navigable but has no context to anchor.
  //
  // In all cases focus moves to the clicked line so subsequent
  // keyboard nav (j/k, e, Esc) starts from where the user just was.
  // Modifier keys are no longer special-cased — cmd/ctrl click went
  // away with the move from "modifier-only context toggle" to
  // "click anywhere expands."
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
 * Custom equality for the memo. See file-level docblock for why id +
 * isVisible + isDimmed is sufficient to capture "this row's data is
 * unchanged" given the immutability of the underlying LogLine source.
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
