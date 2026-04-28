"use client";

import { MotionConfig } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { FilterBar } from "@/components/features/filter-bar/filter-bar";
import { LogList } from "@/components/features/log-list/log-list";
import {
  DEFAULT_CONTEXT_RANGE,
  type OpenContext,
} from "@/lib/context-state";
import { deriveLines } from "@/lib/derive-lines";
import {
  actionForTarget,
  filterReducer,
  hasAnyFilter,
  initialFilterState,
  lineMatchesFilter,
  type FilterAction,
  type FilterState,
  type FilterToggleTarget,
} from "@/lib/filter-state";
import type { LogLine } from "@/types/log";

import styles from "./log-explorer.module.css";

/**
 * How long the per-frame compensation loop runs after a state change.
 * Tracks the longest line transition: 200ms height + 100ms delay = 300ms.
 * Buffer to 350ms so the loop covers any rounding and Motion's settle.
 */
const COMPENSATION_DURATION_MS = 350;

type AnchorSnapshot = { id: string; top: number };

/**
 * Client wrapper that owns interactive state for the log view.
 *
 * Lives on the client because it holds filter state via useReducer.
 * The page itself stays a server component and passes the static
 * mock data in as a prop, which keeps the data import on the server
 * side of the boundary.
 *
 * Filter state changes are folded into the rendered list via
 * deriveLines, memoized so the recompute only fires when either the
 * input array or the filter state changes. Open context windows will
 * become a third dependency in task #3.
 */
export function LogExplorer({ lines }: { lines: readonly LogLine[] }) {
  const [filterState, rawDispatch] = useReducer(
    filterReducer,
    initialFilterState,
  );

  // Single open context for task #3. Task #6 makes this an array; the
  // unified rule already handles multiple windows, so widening here is
  // a one-line change when that lands.
  const [openContext, setOpenContext] = useState<OpenContext | null>(null);

  // Ref to the Radix Scroll Area viewport. The anchor mechanics below
  // read getBoundingClientRect on a target `<li>` and write scrollTop
  // on this viewport — manual compensation rather than relying on
  // overflow-anchor, per spec §6.
  const viewportRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  /**
   * Snapshot the screen position of a given line by id. Returns null if
   * the viewport isn't mounted yet or the line isn't in the DOM (e.g.
   * during initial render before any state has changed).
   */
  const captureAnchor = useCallback(
    (lineId: string): AnchorSnapshot | null => {
      if (!viewportRef.current) return null;
      const el = viewportRef.current.querySelector<HTMLElement>(
        `[data-line-id="${lineId}"]`,
      );
      if (!el) return null;
      return { id: lineId, top: el.getBoundingClientRect().top };
    },
    [],
  );

  /**
   * Pick the topmost line currently in the viewport that will still be
   * visible after a state change. Used by filter dispatches as the
   * anchor target so the user's view stays put even when state changes
   * happen above their visible window or remove the selected line.
   *
   * Iterates only through in-viewport elements (early break once we're
   * past the bottom). Predicts visibility under (nextFilter,
   * nextOpenContext) using the same rule deriveLines applies.
   */
  const findStableViewportAnchor = useCallback(
    (
      nextFilter: FilterState,
      nextOpenContext: OpenContext | null,
    ): string | null => {
      if (!viewportRef.current) return null;
      const viewportRect = viewportRef.current.getBoundingClientRect();

      const indexById = new Map<string, number>();
      for (let i = 0; i < lines.length; i++) {
        indexById.set(lines[i].id, i);
      }

      // Resolve the next context's window once — predicted visibility
      // for surrounding lines depends on it.
      let windowStart: number | null = null;
      let windowEnd: number | null = null;
      if (nextOpenContext) {
        const selectedIdx = indexById.get(nextOpenContext.selectedLineId);
        if (selectedIdx !== undefined) {
          const selected = lines[selectedIdx];
          if (lineMatchesFilter(selected, nextFilter)) {
            windowStart = selectedIdx - nextOpenContext.range;
            windowEnd = selectedIdx + nextOpenContext.range;
          }
        }
      }

      const willBeVisible = (line: LogLine, idx: number): boolean => {
        if (line.isDeployBoundary) return true;
        if (lineMatchesFilter(line, nextFilter)) return true;
        if (windowStart === null || windowEnd === null) return false;
        return idx >= windowStart && idx <= windowEnd;
      };

      const items =
        viewportRef.current.querySelectorAll<HTMLElement>("[data-line-id]");
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        // Skip rows that are above the visible area.
        if (rect.bottom < viewportRect.top) continue;
        // Stop once we're past the bottom — list is in document order.
        if (rect.top > viewportRect.bottom) break;

        const id = item.getAttribute("data-line-id");
        if (!id) continue;
        const idx = indexById.get(id);
        if (idx === undefined) continue;

        if (willBeVisible(lines[idx], idx)) {
          return id;
        }
      }

      return null;
    },
    [lines],
  );

  /**
   * Per-frame compensation loop. After a state change, layout is going
   * to shift over the next ~300ms as Motion animates surrounding line
   * heights. Each frame, we re-measure the anchor element's top and
   * adjust scrollTop by the delta — keeping the anchor visually fixed
   * relative to the viewport throughout the animation.
   *
   * The simple "useLayoutEffect after commit" approach the spec
   * sketches anchors only the end state; this loop is what makes the
   * anchor stay fixed *during* the expand/collapse, which is the
   * craft moment.
   */
  const startCompensation = useCallback((anchor: AnchorSnapshot) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    const deadline = performance.now() + COMPENSATION_DURATION_MS;

    const tick = () => {
      const viewport = viewportRef.current;
      if (!viewport) {
        rafRef.current = null;
        return;
      }
      const el = viewport.querySelector<HTMLElement>(
        `[data-line-id="${anchor.id}"]`,
      );
      if (el) {
        const currentTop = el.getBoundingClientRect().top;
        const delta = currentTop - anchor.top;
        // Sub-pixel deltas can chatter without changing perception;
        // gating at 0.5px keeps the loop quiet near steady state.
        if (Math.abs(delta) > 0.5) {
          viewport.scrollTop += delta;
        }
      }
      if (performance.now() < deadline) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Cancel any in-flight compensation when the explorer unmounts so
  // the rAF loop doesn't try to read a torn-down DOM.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  /**
   * Filter dispatch wrapper that owns three coupled responsibilities:
   *
   *   1. Predict the next filter state and decide whether the open
   *      context survives. Spec §3 hides the View Context affordance
   *      when no filter is active and spec §5 gates context activation
   *      on the selected line matching the filter — mirror that gate
   *      here so the saved state matches what's reachable.
   *   2. Anchor the user's view. Capture the topmost-currently-
   *      visible line that will still be visible after the change,
   *      then run a per-frame scrollTop compensation so that line
   *      stays put visually while surrounding lines reflow.
   *   3. Apply the actual state changes (filter dispatch + optional
   *      openContext clear).
   *
   * Doing the cleanup and the anchor selection together keeps both
   * tied to the action that triggered them — no post-render reactive
   * effects.
   */
  const dispatchFilter = useCallback(
    (action: FilterAction) => {
      const nextFilter = filterReducer(filterState, action);

      // Decide whether openContext survives the next filter state.
      let nextOpenContext: OpenContext | null = openContext;
      if (openContext) {
        const selected = lines.find(
          (l) => l.id === openContext.selectedLineId,
        );
        const stillActivatable =
          !!selected &&
          hasAnyFilter(nextFilter) &&
          lineMatchesFilter(selected, nextFilter);
        if (!stillActivatable) {
          nextOpenContext = null;
        }
      }

      const anchorId = findStableViewportAnchor(nextFilter, nextOpenContext);
      const anchor = anchorId ? captureAnchor(anchorId) : null;

      rawDispatch(action);
      if (nextOpenContext !== openContext) {
        setOpenContext(nextOpenContext);
      }

      if (anchor) startCompensation(anchor);
    },
    [
      filterState,
      openContext,
      lines,
      captureAnchor,
      findStableViewportAnchor,
      startCompensation,
    ],
  );

  const derivedLines = useMemo(
    () => deriveLines(lines, filterState, openContext ? [openContext] : []),
    [lines, filterState, openContext],
  );

  const handleFilterToggle = useCallback(
    (target: FilterToggleTarget) =>
      dispatchFilter(actionForTarget(target)),
    [dispatchFilter],
  );

  /**
   * Toggle a View Context window on the given line.
   *
   * Spec §3 gates: only available on filter-matched (non-context-only)
   * lines, and only when at least one filter is active. The first guard
   * checks the dimmed flag of the derived line — a dimmed line is
   * visible only because some other context revealed it, so opening a
   * nested context on it is disallowed.
   *
   * Toggling on the currently selected line closes the context.
   *
   * The toggled line is the explicit anchor target — the user clicked
   * it, so it should stay fixed on screen while surrounding lines
   * expand or collapse around it.
   */
  const handleToggleContext = useCallback(
    (lineId: string) => {
      if (!hasAnyFilter(filterState)) return;
      const target = derivedLines.find((l) => l.id === lineId);
      if (!target || target.isDimmed) return;

      const anchor = captureAnchor(lineId);

      setOpenContext((current) =>
        current?.selectedLineId === lineId
          ? null
          : { selectedLineId: lineId, range: DEFAULT_CONTEXT_RANGE },
      );

      if (anchor) startCompensation(anchor);
    },
    [filterState, derivedLines, captureAnchor, startCompensation],
  );

  return (
    // reducedMotion="user" honors the OS-level prefers-reduced-motion
    // setting — Motion drops durations to ~0 so the line transitions
    // don't run, but the final state still resolves correctly.
    <MotionConfig reducedMotion="user">
      <div className={styles.explorer}>
        <FilterBar state={filterState} dispatch={dispatchFilter} />
        <LogList
          lines={derivedLines}
          viewportRef={viewportRef}
          onFilterToggle={handleFilterToggle}
          onToggleContext={handleToggleContext}
          selectedLineId={openContext?.selectedLineId}
        />
      </div>
    </MotionConfig>
  );
}
