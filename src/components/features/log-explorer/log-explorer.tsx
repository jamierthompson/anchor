"use client";

import { MotionConfig } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  type FilterToggleTarget,
} from "@/lib/filter-state";
import type { LogLine } from "@/types/log";

import styles from "./log-explorer.module.css";

/**
 * How long the per-frame compensation loop runs after a state change.
 *
 * Longest single-line transition is the collapse path: 150ms opacity
 * + 150ms delay + 200ms height = 350ms. Motion clears its inline
 * `style` props a frame or two after the animation completes, and
 * that settle pass shifts surrounding heights by a sub-pixel amount.
 * 600ms gives ~250ms of grace past the longest transition — covers
 * the settle without leaking uncompensated drift across repeated
 * toggles.
 */
const COMPENSATION_DURATION_MS = 600;

/**
 * Tolerance for "the user is at the bottom of the list."
 *
 * Live-tail UIs (Slack, Console.app, kubectl logs --follow) treat
 * "at the bottom" as a sticky state — once you're there, new content
 * auto-scrolls into view. Once you scroll up to investigate, the
 * stream freezes for you.
 *
 * 50px is loose enough to count "I just scrolled up by a hair while
 * the tail kept moving" as still-at-bottom, tight enough that
 * actively scrolling away clearly disengages the stick.
 */
const AT_BOTTOM_TOLERANCE_PX = 50;

/**
 * Stable empty set returned by `effectiveSelectedLineIds` when no
 * accent should render. Reusing one instance keeps the prop reference
 * stable across renders so LogList isn't re-keyed unnecessarily.
 */
const EMPTY_SELECTED_SET: ReadonlySet<string> = new Set();

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

  // Open View Context windows. Multiple may be active simultaneously
  // (spec §4 — "no cap initially"). Array order doubles as recency:
  // the most recently toggled context is appended at the end. This
  // matters for the spec §4 anchor-priority rule — the most recently
  // selected context line is the scroll anchor — which is enforced
  // implicitly by `handleToggleContext` calling `setAnchorLineId` with
  // the toggled line on every dispatch.
  //
  // The unified rule in `deriveLines` already accepts an array of open
  // contexts and handles overlapping windows correctly (a line is
  // visible if ANY context covers it; undimmed only if it matches the
  // filter regardless of how many windows include it). So widening
  // from `OpenContext | null` to `OpenContext[]` here doesn't require
  // any changes to the derivation.
  const [openContexts, setOpenContexts] = useState<readonly OpenContext[]>(
    [],
  );

  // Keyboard-navigable focus, distinct from `openContexts` (the selection
  // accent). Spec §7: a focused line gets a "subtle outline" — visually
  // separate from the left-border accent that marks a context anchor.
  //
  // We use the **aria-activedescendant** pattern, not roving tabindex:
  //   - The <ul> is the only Tab stop. tabIndex on individual <li>s
  //     would mean Tab walks every line, which makes the list a focus
  //     trap.
  //   - `focusedLineId` is internal state; LogList renders it as
  //     `aria-activedescendant="line_<id>"` on the <ul> and as
  //     `data-focused="true"` on the matching <li> for the CSS outline.
  //   - Screen readers honor aria-activedescendant: they announce the
  //     "active descendant" as if it were focused, even though DOM focus
  //     stays on the <ul>.
  //   - Tab continues normally through buttons inside lines (instance
  //     pills, level badges) — no manual Tab-handling needed to keep the
  //     list as a single focus container.
  //
  // Compared to roving tabindex, this trades native :focus-visible for
  // a manual outline rule, but saves us from juggling .focus() calls
  // and Tab interception. For a list with focusable children, it's the
  // simpler correct choice.
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);

  // Single spatial anchor for the per-frame scroll compensation.
  // Resolved per dispatch with this priority:
  //   1. The line the user clicked from (pill click, context toggle).
  //   2. The previously-set anchor if it's still in viewport — keeps
  //      the spatial story coherent across follow-up dispatches.
  //   3. The line nearest the viewport's vertical center (fallback).
  const [anchorLineId, setAnchorLineId] = useState<string | null>(null);

  // Animation mode for line height transitions in LogList. "slow"
  // during context toggles (heights ease as part of the choreography);
  // "instant" otherwise (filters resolve snappily). Set by
  // handleToggleContext, auto-clears after the slow animation ends.
  const [transitionMode, setTransitionMode] = useState<"instant" | "slow">(
    "instant",
  );
  const slowModeTimeoutRef = useRef<number | null>(null);

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
   * Whether the line with the given id is currently visible in the
   * viewport. Used to decide whether a previously-set anchor (e.g.
   * from a context expansion) is still a meaningful reference for the
   * current dispatch — if it's scrolled out of view, the spatial
   * story has moved on and we should pick a fresh anchor.
   */
  const isInViewport = useCallback((lineId: string): boolean => {
    if (!viewportRef.current) return false;
    const viewport = viewportRef.current;
    const el = viewport.querySelector<HTMLElement>(
      `[data-line-id="${lineId}"]`,
    );
    if (!el) return false;
    const viewportRect = viewport.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return (
      elRect.bottom >= viewportRect.top && elRect.top <= viewportRect.bottom
    );
  }, []);

  /**
   * Pick the line whose vertical center is closest to the viewport's
   * vertical center. Fallback anchor when no source line is provided
   * and no previous anchor remains in viewport. Pure spatial — doesn't
   * predict survival, doesn't care about derive.
   */
  const findMiddleVisibleLine = useCallback((): string | null => {
    if (!viewportRef.current) return null;
    const viewport = viewportRef.current;
    const viewportRect = viewport.getBoundingClientRect();
    const middleY = viewportRect.top + viewportRect.height / 2;
    const items = viewport.querySelectorAll<HTMLElement>("[data-line-id]");

    let bestId: string | null = null;
    let bestDistance = Infinity;
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (rect.bottom < viewportRect.top) continue;
      if (rect.top > viewportRect.bottom) break;
      const itemMiddle = rect.top + rect.height / 2;
      const dist = Math.abs(itemMiddle - middleY);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestId = item.getAttribute("data-line-id");
      }
    }
    return bestId;
  }, []);

  /**
   * Resolve the anchor for a dispatch under the priority rules:
   *   1. Caller-supplied source line (pill click, context toggle).
   *   2. Existing anchor if still in viewport.
   *   3. Middle-of-viewport fallback.
   * Returns the chosen id (or null if the viewport is empty).
   */
  const resolveAnchor = useCallback(
    (sourceLineId?: string): string | null => {
      if (sourceLineId) return sourceLineId;
      if (anchorLineId && isInViewport(anchorLineId)) return anchorLineId;
      return findMiddleVisibleLine();
    },
    [anchorLineId, isInViewport, findMiddleVisibleLine],
  );

  /**
   * Whether the user is currently at (or within tolerance of) the
   * bottom of the list. Drives the live-tail "stick" behavior — at-
   * bottom users get auto-scrolled to follow content as the document
   * shrinks; scrolled-up users get pinned to their visible content
   * via anchor compensation instead.
   */
  const isAtBottom = useCallback((): boolean => {
    if (!viewportRef.current) return false;
    const v = viewportRef.current;
    const maxScroll = v.scrollHeight - v.clientHeight;
    return v.scrollTop >= maxScroll - AT_BOTTOM_TOLERANCE_PX;
  }, []);

  /**
   * Per-frame loop that pins scrollTop to the bottom of the list.
   * Used after a dispatch when the user was at-bottom. As Motion
   * animates hiding lines toward height: 0 the document `scrollHeight`
   * shrinks smoothly; setting `scrollTop` to the new max each frame
   * keeps the user glued to the bottom for the duration. Reads as a
   * smooth scroll-toward-bottom rather than a snap, because the
   * scrollHeight change itself is gradual.
   */
  const startStickToBottom = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const deadline = performance.now() + COMPENSATION_DURATION_MS;

    const tick = () => {
      const v = viewportRef.current;
      if (!v) {
        rafRef.current = null;
        return;
      }
      const target = Math.max(0, v.scrollHeight - v.clientHeight);
      if (Math.abs(target - v.scrollTop) > 0.5) {
        v.scrollTop = target;
      }
      if (performance.now() < deadline) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

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

  // Cancel any in-flight rAF / timeout when the explorer unmounts so
  // they don't try to touch a torn-down DOM.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (slowModeTimeoutRef.current !== null)
        clearTimeout(slowModeTimeoutRef.current);
    };
  }, []);

  // Live-tail convention: open at the bottom of the list. useLayoutEffect
  // runs after hydration commit but BEFORE the browser's next paint,
  // so the post-hydration paint shows the bottom — no flash of "wrong
  // scroll position" from this effect.
  //
  // BUT — Next.js SSRs the LogExplorer's first render. The initial
  // HTML lands in the browser at scrollTop=0 and PAINTS before JS
  // hydrates. To prevent that pre-hydration flash, the viewport is
  // hidden via CSS until we set `data-scroll-ready` here. The user
  // sees a brief blank during JS load, then the bottom of the list —
  // never the top with mid-list deploy boundaries flashing through.
  useLayoutEffect(() => {
    const v = viewportRef.current;
    if (!v) return;
    v.scrollTop = v.scrollHeight - v.clientHeight;
    v.setAttribute("data-scroll-ready", "true");
  }, []);

  /**
   * Filter dispatch wrapper.
   *
   * Two scroll behaviors after the dispatch, branched on whether the
   * user is at the bottom of the list (live-tail convention):
   *
   *   - At-bottom: stick to the bottom. As Motion shrinks hiding
   *     lines, `startStickToBottom` follows the new max scrollTop
   *     each frame. The user's view smoothly trails the bottom of
   *     content. Matches Slack/Console.app/`logs --follow` behavior.
   *
   *   - Scrolled-up: pin a visible line via anchor compensation. The
   *     anchor is resolved by priority — `sourceLineId` (pill click)
   *     wins, else the previous anchor if still in viewport, else
   *     middle-of-viewport. Their reading position stays put.
   *
   * Open context state is *not* mutated here — per spec §5, when a
   * filter change excludes the selected line we preserve the
   * `selectedLineId` so that loosening the filter later brings the
   * context back in place. The visibility half of that rule is
   * already handled by `deriveLines` (windowed reveals collapse to
   * hidden when the selected line stops matching). The visual
   * selected-accent is suppressed via `effectiveSelectedLineId`
   * below — the saved state is real, the blue edge just doesn't
   * render until the gate is satisfied again.
   */
  const dispatchFilter = useCallback(
    (action: FilterAction, sourceLineId?: string) => {
      const wasAtBottom = isAtBottom();

      // Filter dispatches override any in-flight slow mode left over
      // from a recent context toggle — the filter's snappy resolution
      // is the dominant interaction.
      if (slowModeTimeoutRef.current !== null) {
        clearTimeout(slowModeTimeoutRef.current);
        slowModeTimeoutRef.current = null;
      }
      if (transitionMode !== "instant") setTransitionMode("instant");

      // Resolve anchor for the not-at-bottom branch. Cheap to compute
      // even if we end up sticking-to-bottom — we still update
      // anchorLineId so later dispatches have continuity.
      const nextAnchorId = resolveAnchor(sourceLineId);
      const anchor =
        !wasAtBottom && nextAnchorId ? captureAnchor(nextAnchorId) : null;
      if (nextAnchorId && nextAnchorId !== anchorLineId) {
        setAnchorLineId(nextAnchorId);
      }

      rawDispatch(action);

      if (wasAtBottom) {
        startStickToBottom();
      } else if (anchor) {
        startCompensation(anchor);
      }
    },
    [
      anchorLineId,
      transitionMode,
      captureAnchor,
      resolveAnchor,
      isAtBottom,
      startStickToBottom,
      startCompensation,
    ],
  );

  const derivedLines = useMemo(
    () => deriveLines(lines, filterState, openContexts),
    [lines, filterState, openContexts],
  );

  /**
   * The set of line ids that should currently render the selected-accent
   * visual (left border + anchor icon).
   *
   * Open contexts are preserved across filter changes (spec §5) so that
   * loosening a filter restores the saved selection in place. But the
   * accent should only render while the selection is *meaningful* — at
   * least one filter active AND the selected line still matches. When
   * either part of the gate fails for an entry, the saved state stays
   * put behind the scenes but its accent disappears.
   *
   * Returned as a Set so LogList does O(1) per-row lookup as it walks
   * the rendered array.
   */
  const effectiveSelectedLineIds = useMemo<ReadonlySet<string>>(() => {
    if (openContexts.length === 0) return EMPTY_SELECTED_SET;
    if (!hasAnyFilter(filterState)) return EMPTY_SELECTED_SET;
    const ids = new Set<string>();
    for (const ctx of openContexts) {
      const selected = lines.find((l) => l.id === ctx.selectedLineId);
      if (!selected) continue;
      if (lineMatchesFilter(selected, filterState)) ids.add(ctx.selectedLineId);
    }
    return ids;
  }, [openContexts, filterState, lines]);

  const handleFilterToggle = useCallback(
    (target: FilterToggleTarget, sourceLineId: string) =>
      dispatchFilter(actionForTarget(target), sourceLineId),
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
   * Toggling on a line that already has a context window closes that
   * one (and leaves any other open contexts alone). Toggling on a new
   * line appends a fresh entry — array order doubles as recency, so the
   * appended entry is by definition the most recent one.
   *
   * The toggled line is the explicit anchor target — the user clicked
   * it, so it should stay fixed on screen while surrounding lines
   * expand or collapse around it. This is exactly spec §4's anchor-
   * priority rule ("most recently selected is the scroll anchor"):
   * each toggle resets `anchorLineId` to the line just acted on, so a
   * subsequent filter dispatch falls through to the right reference.
   */
  const handleToggleContext = useCallback(
    (lineId: string) => {
      if (!hasAnyFilter(filterState)) return;
      const target = derivedLines.find((l) => l.id === lineId);
      if (!target || target.isDimmed) return;

      const anchor = captureAnchor(lineId);

      // The toggled line is the spatial anchor — scroll compensation
      // pins it while context lines fluidly expand/collapse. Holds
      // whether we're opening or closing on this line: the user just
      // clicked it, so it's the natural visual reference for the
      // surrounding animation.
      if (lineId !== anchorLineId) setAnchorLineId(lineId);

      // Switch into slow mode for the duration of the slow animation.
      // The longest path is collapse: 150ms opacity + 150ms delay +
      // 200ms height = 500ms total, with a small Motion settle
      // buffer.
      setTransitionMode("slow");
      if (slowModeTimeoutRef.current !== null)
        clearTimeout(slowModeTimeoutRef.current);
      slowModeTimeoutRef.current = window.setTimeout(() => {
        setTransitionMode("instant");
        slowModeTimeoutRef.current = null;
      }, 600);

      setOpenContexts((current) => {
        const existingIndex = current.findIndex(
          (c) => c.selectedLineId === lineId,
        );
        if (existingIndex !== -1) {
          // Close: drop the matching entry, preserve the order of the rest.
          return current.filter((_, i) => i !== existingIndex);
        }
        // Open: append so the newest is at the end (most-recent invariant).
        return [
          ...current,
          { selectedLineId: lineId, range: DEFAULT_CONTEXT_RANGE },
        ];
      });

      if (anchor) startCompensation(anchor);
    },
    [
      filterState,
      derivedLines,
      anchorLineId,
      captureAnchor,
      startCompensation,
    ],
  );

  /**
   * Focus persistence rule (spec §7): the *saved* focus (`focusedLineId`)
   * is what the user explicitly set; the *effective* focus is what
   * actually renders. When the saved line is hidden by a filter change
   * or context collapse, the effective focus hops to the nearest
   * visible line by array-index distance — preferring the next visible
   * line below (reading direction) over the previous one above.
   *
   * Computed during render rather than synced via setState-in-effect.
   * This is the React 19 best practice for derived state and gives us
   * a useful side benefit: the saved focus persists across filter
   * changes the same way `openContexts` does. If the user un-filters
   * later, the saved focus comes back automatically — same model the
   * selection accent uses.
   *
   * If no line is visible at all, effective focus is null and the
   * listbox renders with no aria-activedescendant.
   */
  const effectiveFocusedLineId = useMemo<string | null>(() => {
    if (!focusedLineId) return null;
    const focused = derivedLines.find((l) => l.id === focusedLineId);
    if (focused?.isVisible) return focusedLineId;

    const focusedIndex = derivedLines.findIndex(
      (l) => l.id === focusedLineId,
    );
    if (focusedIndex === -1) return null;

    for (let i = focusedIndex + 1; i < derivedLines.length; i++) {
      if (derivedLines[i].isVisible) return derivedLines[i].id;
    }
    for (let i = focusedIndex - 1; i >= 0; i--) {
      if (derivedLines[i].isVisible) return derivedLines[i].id;
    }
    return null;
  }, [derivedLines, focusedLineId]);

  /**
   * When focus moves (programmatically or via click), scroll the
   * effective focus into view if it's outside the viewport. Use
   * `block: "nearest"` so already-visible focused lines don't trigger
   * a scroll — only lines actually past the top/bottom edges do.
   *
   * Keys on the *effective* id, not the saved one, so a "hopped to
   * nearest visible" line also gets scrolled into view.
   */
  useEffect(() => {
    if (!effectiveFocusedLineId || !viewportRef.current) return;
    const el = viewportRef.current.querySelector<HTMLElement>(
      `[data-line-id="${effectiveFocusedLineId}"]`,
    );
    if (!el) return;
    // jsdom doesn't implement scrollIntoView (it's a layout API). The
    // typeof guard keeps unit tests from blowing up while leaving the
    // real browser behavior untouched.
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [effectiveFocusedLineId]);

  /**
   * Keyboard handler attached to the LogList's <ul>. Receives
   * KeyboardEvents only when the list is focused (Tab into it, or any
   * descendant has focus and the event bubbles up).
   *
   * Bindings (spec §7):
   *
   *   j / ArrowDown — focus next visible line
   *   k / ArrowUp   — focus previous visible line
   *   g             — focus first visible line
   *   G (shift+g)   — focus last visible line
   *   [             — focus previous deploy boundary
   *   ]             — focus next deploy boundary
   *
   * Arrow keys and j/k are first-class equivalents — arrow keys are
   * the discoverable default; j/k is the Vim/Linear/Slack power-user
   * convention. g/G follows the Vim/less convention (lowercase = top,
   * shift = bottom). [ and ] jump between deploy boundaries — global
   * section markers in the log feed (spec §5) that are always visible
   * regardless of filter.
   *
   * Visible lines are the navigable set for j/k/g/G; deploy
   * boundaries are their own set for [/]. A hidden line is
   * functionally not there for navigation.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      // Ignore browser-claimed modifier combos. cmd/ctrl + j is a
      // downloads shortcut on Chrome; alt-prefixed keys are reserved
      // for OS/browser bindings on most platforms.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const { key, shiftKey } = event;

      // Reject any shifted key that isn't shift+g. Single exception
      // keeps the rule "no shift" almost universal — accepting both
      // `key === "G"` and `key === "g"` here matches the dual check
      // for `isLast` below.
      if (shiftKey && key !== "G" && key !== "g") return;

      const isNext = !shiftKey && (key === "j" || key === "ArrowDown");
      const isPrev = !shiftKey && (key === "k" || key === "ArrowUp");
      const isFirst = !shiftKey && key === "g";
      // Accept both forms — `key: "G"` is what most browsers fire for
      // shift+g on US keyboards, but some testing tools and non-US
      // layouts fire `key: "g"` with shiftKey true. Handling both
      // makes the binding robust without changing the user-facing
      // contract.
      const isLast = shiftKey && (key === "G" || key === "g");
      const isPrevBoundary = !shiftKey && key === "[";
      const isNextBoundary = !shiftKey && key === "]";
      const isToggleContext = !shiftKey && key === "e";

      if (
        !isNext &&
        !isPrev &&
        !isFirst &&
        !isLast &&
        !isPrevBoundary &&
        !isNextBoundary &&
        !isToggleContext
      ) {
        return;
      }

      // Context toggle on the focused line. Reuses the same handler
      // that powers the cmd/ctrl-click modifier — same §3 gate
      // (requires a filter active, not allowed on dimmed lines), same
      // append/remove semantics, same scroll compensation. The
      // keyboard binding is just a different input path into the same
      // pipeline.
      //
      // Bails silently if no line is focused — the binding has no
      // target, but we still preventDefault so the bare `e` doesn't
      // leak through to anything else.
      if (isToggleContext) {
        event.preventDefault();
        if (effectiveFocusedLineId) {
          handleToggleContext(effectiveFocusedLineId);
        }
        return;
      }

      // Boundary navigation has its own filter (deploy boundaries
      // only) and direction logic — separate it out from the
      // visible-lines path used by j/k/g/G.
      if (isPrevBoundary || isNextBoundary) {
        const boundaries = derivedLines.filter((l) => l.isDeployBoundary);
        if (boundaries.length === 0) return;
        event.preventDefault();

        // Compare against the *full* derivedLines index, not the
        // boundaries-filtered index — "previous boundary" means "the
        // boundary whose array index is the largest one still less
        // than the focused line's index."
        const focusIdx = effectiveFocusedLineId
          ? derivedLines.findIndex((l) => l.id === effectiveFocusedLineId)
          : -1;

        let target: string | null = null;
        if (isNextBoundary) {
          for (const b of boundaries) {
            const bi = derivedLines.findIndex((l) => l.id === b.id);
            if (bi > focusIdx) {
              target = b.id;
              break;
            }
          }
          // From no focus (or past the last boundary), wrap to the
          // first boundary so the binding always does something.
          if (!target) target = boundaries[0].id;
        } else {
          // Walk from the end so we land on the largest-index
          // boundary still strictly less than focusIdx.
          for (let i = boundaries.length - 1; i >= 0; i--) {
            const bi = derivedLines.findIndex(
              (l) => l.id === boundaries[i].id,
            );
            if (focusIdx === -1 || bi < focusIdx) {
              target = boundaries[i].id;
              break;
            }
          }
          // From no focus (or before the first boundary), fall back
          // to the last boundary — same wrap semantics as next.
          if (!target) target = boundaries[boundaries.length - 1].id;
        }

        if (target) setFocusedLineId(target);
        return;
      }

      const visible = derivedLines.filter((l) => l.isVisible);
      if (visible.length === 0) return;

      // Arrow keys would otherwise scroll the list; preventDefault
      // claims them for our nav.
      event.preventDefault();

      // Use the *effective* id as the navigation reference: if the
      // saved focus is hidden right now, the user sees the hopped-to
      // visible line and expects j/k to advance from there.
      const currentIndex = effectiveFocusedLineId
        ? visible.findIndex((l) => l.id === effectiveFocusedLineId)
        : -1;

      let nextIndex: number;
      if (isFirst) {
        nextIndex = 0;
      } else if (isLast) {
        nextIndex = visible.length - 1;
      } else if (currentIndex === -1) {
        // Nothing focused yet — "next" starts at the top, "previous"
        // at the bottom.
        nextIndex = isNext ? 0 : visible.length - 1;
      } else if (isNext) {
        nextIndex = Math.min(currentIndex + 1, visible.length - 1);
      } else {
        nextIndex = Math.max(currentIndex - 1, 0);
      }

      setFocusedLineId(visible[nextIndex].id);
    },
    [derivedLines, effectiveFocusedLineId, handleToggleContext],
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
          onLineFocus={setFocusedLineId}
          onKeyDown={handleKeyDown}
          selectedLineIds={effectiveSelectedLineIds}
          focusedLineId={effectiveFocusedLineId}
          transitionMode={transitionMode}
        />
      </div>
    </MotionConfig>
  );
}
