"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { Legend, type LegendItem } from "@/components/features/legend/legend";
import { LogList } from "@/components/features/log-list/log-list";
import { UnreadStrip } from "@/components/features/log-list/unread-strip";
import { ScenarioChips } from "@/components/features/scenario-chips/scenario-chips";
import { ShortcutSheet } from "@/components/features/shortcut-sheet/shortcut-sheet";
import { liveTailSeed } from "@/lib/mock-logs";
import { useLiveTail } from "@/lib/use-live-tail";
import { useStableCallback } from "@/lib/use-stable-callback";
import {
  CONTEXT_RANGE_STEP,
  DEFAULT_CONTEXT_RANGE,
  isAtFileBoundary,
  type OpenContext,
} from "@/lib/context-state";
import { deriveLines } from "@/lib/derive-lines";
import {
  filterReducer,
  hasAnyFilter,
  initialFilterState,
  lineMatchesFilter,
  type FilterAction,
} from "@/lib/filter-state";
import type { LogLine } from "@/types/log";

import styles from "./log-explorer.module.css";

/**
 * How long the per-frame compensation loop runs after a state change.
 *
 * Long enough to cover the longest line transition plus a small grace
 * window so we don't leak uncompensated drift across repeated toggles,
 * and absorb any sub-pixel settle from the browser's layout pass once
 * the transition finishes.
 */
const COMPENSATION_DURATION_MS = 600;

/**
 * Tolerance for "the user is at the bottom of the list."
 *
 * Live-tail UIs treat "at the bottom" as a sticky state — once you're there, new content
 * auto-scrolls into view. Once you scroll up to investigate, the
 * stream freezes for you.
 *
 * 50px is loose enough to count "I just scrolled up by a hair while
 * the tail kept moving" as still-at-bottom, tight enough that
 * actively scrolling away clearly disengages the stick.
 */
const AT_BOTTOM_TOLERANCE_PX = 50;

/**
 * Stable empty set returned by `effectiveSelectedContextLineIds` when
 * no accent should render. Reusing one instance keeps the prop
 * reference stable across renders so LogList doesn't re-render
 * unnecessarily.
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
 * deriveLines, memoized so the recompute only fires when the input
 * array, the filter state, or the set of open context windows
 * changes.
 */
export function LogExplorer({
  lines: initialLines,
}: {
  lines: readonly LogLine[];
}) {
  // Live-tail simulation streams seed entries on a hand-curated
  // cadence. `lines` is the combined initial fixture + streamed-so-far
  // entries; `freshIds` is the set of streamed line ids, which LogList
  // uses to gate per-line mount-time animation (animate from height: 0
  // only for streamed lines, not the initial fixture).
  const { lines, freshIds: streamedLineIds } = useLiveTail(
    initialLines,
    liveTailSeed,
  );

  const [filterState, rawDispatch] = useReducer(
    filterReducer,
    initialFilterState,
  );

  // Open View Context windows. Multiple may be active simultaneously.
  // Array order doubles as recency:
  // the most recently toggled context is appended at the end. This
  // matters for the anchor-priority rule — the most recently
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
  const [openContexts, setOpenContexts] = useState<readonly OpenContext[]>([]);

  // Keyboard-navigable focus, distinct from `openContexts` (the selection
  // accent).
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
  //
  // Compared to roving tabindex, this trades native :focus-visible for
  // a manual outline rule, but saves us from juggling .focus() calls
  // and Tab interception. The <ul> stays a single Tab stop and other keys
  // drive movement within it — the listbox role's idiomatic pattern.
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);

  // Single spatial anchor for the per-frame scroll compensation.
  // Resolved per dispatch with this priority:
  //   1. The line the user just acted on (context toggle / expand).
  //   2. The previously-set anchor if it's still in viewport — keeps
  //      the spatial story coherent across follow-up dispatches.
  //   3. The line nearest the viewport's vertical center (fallback).
  // Filter dispatches from ScenarioChips have no spatial origin in
  // the list, so they always fall through to step 2 or 3.
  const [anchorLineId, setAnchorLineId] = useState<string | null>(null);

  // Animation mode for line height transitions in LogList. "slow"
  // during context toggles (heights ease as part of the choreography);
  // "instant" otherwise (filters resolve snappily). Set by
  // handleToggleContext, auto-clears after the slow animation ends.
  const [transitionMode, setTransitionMode] = useState<"instant" | "slow">(
    "instant",
  );
  const slowModeTimeoutRef = useRef<number | null>(null);

  // Open state for the shortcut surface. Lifted here so the document-
  // level `?` handler — which lives outside the dialog tree — can flip
  // it. The `?` binding is open-only; dismissal is owned by the dialog
  // primitive (Esc / click-outside).
  const [sheetOpen, setSheetOpen] = useState(false);

  // Counter that increments on every *successful* expansion press.
  // Used as a remount key on the matching keyboard-hint entry so a CSS
  // keyframe animation re-fires each press — gives the user a visible
  // flash even when the entry's label is unchanged. Without this, two
  // back-to-back expansions look identical in the surrounding chrome
  // and the user can't tell whether their key registered.
  const [legendPulseKey, setLegendPulseKey] = useState(0);

  // Ref to the scroll viewport. The anchor mechanics below read
  // getBoundingClientRect on a target `<li>` and write scrollTop on
  // this viewport — manual compensation rather than relying on browser
  // overflow-anchor, which doesn't fire frequently enough during
  // animated height changes.
  const viewportRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  /**
   * Snapshot the screen position of a given line by id. Returns null if
   * the viewport isn't mounted yet or the line isn't in the DOM (e.g.
   * during initial render before any state has changed).
   */
  const captureAnchor = useCallback((lineId: string): AnchorSnapshot | null => {
    if (!viewportRef.current) return null;
    const el = viewportRef.current.querySelector<HTMLElement>(
      `[data-line-id="${lineId}"]`,
    );
    if (!el) return null;
    return { id: lineId, top: el.getBoundingClientRect().top };
  }, []);

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
   *   1. Caller-supplied source line (used by the context-toggle
   *      paths to pin the line the user just acted on).
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
   * Used after a dispatch when the user was at-bottom. As CSS animates
   * hiding lines toward height: 0 the document `scrollHeight` shrinks
   * smoothly; setting `scrollTop` to the new max each frame keeps the
   * user glued to the bottom for the duration. Reads as a smooth
   * scroll-toward-bottom rather than a snap, because the scrollHeight
   * change itself is gradual.
   */
  const startStickToBottom = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const deadline = performance.now() + COMPENSATION_DURATION_MS;
    /*
     * User-scroll-disengage. We record what we last wrote to
     * scrollTop; on the next frame, if the current scrollTop
     * differs from our last write by more than ~1px, only the user
     * could have moved it (the document growing doesn't shift
     * scrollTop on its own — see the rAF tick body). Abort the loop
     * so we stop fighting their input.
     *
     * Once aborted, subsequent tail-line arrivals see isAtBottom()
     * = false (user is past the at-bottom tolerance) and route through
     * unreadCount → the unread-jump affordance — the stick doesn't
     * re-engage until the user scrolls back to bottom.
     *
     * Matches the live-tail convention used by terminal log followers
     * and chat clients.
     */
    let lastWrittenScrollTop: number | null = null;

    const tick = () => {
      const v = viewportRef.current;
      if (!v) {
        rafRef.current = null;
        return;
      }
      if (
        lastWrittenScrollTop !== null &&
        Math.abs(v.scrollTop - lastWrittenScrollTop) > 1
      ) {
        rafRef.current = null;
        return;
      }
      const target = Math.max(0, v.scrollHeight - v.clientHeight);
      if (Math.abs(target - v.scrollTop) > 0.5) {
        v.scrollTop = target;
      }
      lastWrittenScrollTop = v.scrollTop;
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
   * to shift over the next ~300ms as CSS animates surrounding line
   * heights. Each frame, we re-measure the anchor element's top and
   * adjust scrollTop by the delta — keeping the anchor visually fixed
   * relative to the viewport throughout the animation.
   *
   * A "useLayoutEffect after commit" approach would only anchor the
   * end state; this loop is what makes the anchor stay fixed *during*
   * the expand/collapse.
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

  /**
   * Count surfaced by the unread-jump affordance.
   * Increments when a streamed line arrives AND the user is scrolled
   * away from the bottom. Resets to 0 when:
   *   - The user activates the unread-jump affordance (smooth-scrolls
   *     to bottom + reset).
   *   - The user organically scrolls to the bottom of the list (the
   *     scroll-listener effect below detects this).
   * Filter-hidden streamed lines aren't counted — the affordance only
   * surfaces lines the user could currently see if they scrolled.
   */
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * Live-tail line-arrival handler. Two branches on every append,
   * gated by whether the user is at the bottom:
   *
   *   - At-bottom → kick off `startStickToBottom`. As CSS grows the
   *     new line's height from 0 → auto, the document grows
   *     underneath, and the rAF loop tracks `scrollHeight -
   *     clientHeight` each frame so the user stays glued to the
   *     most-recent line.
   *   - Scrolled-up → increment `unreadCount` so the unread-jump
   *     affordance surfaces. The newly-appended line is below the
   *     fold; the count is the user's "I'm missing things" signal.
   *
   * useLayoutEffect (not useEffect) so the scroll adjustment commits
   * synchronously before paint — avoids a one-frame flash where the
   * document has grown but scrollTop hasn't caught up yet.
   */
  const prevLinesLengthRef = useRef(lines.length);
  useLayoutEffect(() => {
    const delta = lines.length - prevLinesLengthRef.current;
    prevLinesLengthRef.current = lines.length;
    if (delta <= 0) return;
    // Skip live-tail follow while a context-toggle animation is in
    // flight. The two scroll-compensation loops share a single rAF
    // slot (only one loop at a time); without this guard, a tail tick
    // mid-toggle would cancel the in-flight compensation and visibly
    // drift the anchor. The user's deliberate context interaction wins
    // for the duration of the compensation budget; live-tail follow
    // resumes on the next tick after slow mode clears. The newly-
    // appended line still mounts and animates in via the per-row
    // entrance rule — only the scroll side-effect is deferred.
    if (transitionMode === "slow") return;
    if (isAtBottom()) {
      startStickToBottom();
    } else {
      setUnreadCount((c) => c + delta);
    }
  }, [lines.length, isAtBottom, startStickToBottom, transitionMode]);

  /**
   * Reset the unread count when the user organically scrolls to the
   * bottom of the list (without activating the unread-jump affordance).
   * Catches the case where the user manually drags the scrollbar to
   * bottom — the affordance should disappear, count should reset.
   */
  useEffect(() => {
    const v = viewportRef.current;
    if (!v) return;
    const onScroll = () => {
      if (isAtBottom() && unreadCount !== 0) setUnreadCount(0);
    };
    v.addEventListener("scroll", onScroll, { passive: true });
    return () => v.removeEventListener("scroll", onScroll);
  }, [unreadCount, isAtBottom]);

  /**
   * Mirror at-bottom state to <html data-demo-at-bottom> so external
   * chrome can react without a React context bridge. The /demo route's
   * footer-reveal scroller reads this to snap back to parked when the
   * user scrolls up away from the tail.
   */
  useEffect(() => {
    const v = viewportRef.current;
    if (!v) return;
    const html = document.documentElement;
    const update = () => {
      html.dataset.demoAtBottom = isAtBottom() ? "true" : "false";
    };
    update();
    v.addEventListener("scroll", update, { passive: true });
    return () => {
      v.removeEventListener("scroll", update);
      delete html.dataset.demoAtBottom;
    };
  }, [isAtBottom]);

  /**
   * Activation handler for the unread-jump affordance — smooth-scroll
   * to bottom + reset count. Uses native `scrollTo({ behavior:
   * "smooth" })` rather than the rAF compensation loop because this
   * is a USER-initiated jump (vs. animation tracking). The platform
   * scroll engine composites correctly with whatever line transitions
   * are in flight.
   */
  const handleScrollToBottom = useCallback(() => {
    const v = viewportRef.current;
    if (!v) return;
    v.scrollTo({
      top: v.scrollHeight - v.clientHeight,
      behavior: "smooth",
    });
    setUnreadCount(0);
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
   *   - At-bottom: stick to the bottom. As CSS shrinks hiding lines,
   *     `startStickToBottom` follows the new max scrollTop each
   *     frame. The user's view smoothly trails the bottom of
   *     content. Matches the live-tail convention of terminal log
   *     followers and chat clients.
   *
   *   - Scrolled-up: pin a visible line via anchor compensation. The
   *     anchor falls through to the previous anchor (if still in
   *     viewport) or middle-of-viewport — current chip-driven
   *     dispatches don't supply a `sourceLineId`. Their reading
   *     position stays put.
   *
   * Open context state is *not* mutated here, when a
   * filter change excludes the selected line we preserve the
   * `selectedLineId` so that loosening the filter later brings the
   * context back in place. The visibility half of that rule is
   * already handled by `deriveLines` (windowed reveals collapse to
   * hidden when the selected line stops matching). The visual
   * selected-accent is suppressed via
   * `effectiveSelectedContextLineIds` below — the saved state is
   * real, the accent just doesn't render until the gate is satisfied
   * again.
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
   * Stable handler for the clear-filter path, shared by the keyboard-
   * hint mouse click and the document-level Esc key. Wrapping
   * dispatchFilter in useStableCallback gives a stable outer reference
   * that always delegates to the latest dispatchFilter closure — and
   * as a bonus avoids a static-analysis warning about reading refs
   * during render that would otherwise fire on a useCallback-wrapped
   * variant.
   */
  const handleClearFilter = useStableCallback(() =>
    dispatchFilter({ type: "clear" }),
  );

  /**
   * Set of line ids whose context-anchor accent should render. Open
   * contexts are preserved across filter changes so that loosening a
   * filter restores the saved selection in place — but the accent
   * should only render while the selection is *meaningful* — at least
   * one filter active AND the selected line still matches. When either
   * part of the gate fails for an entry, the saved state stays put
   * behind the scenes but its accent disappears.
   *
   * Range data is no longer per-line: the only consumer of the most-
   * recent range reads it directly from `openContexts`, so a Set of
   * ids is sufficient here.
   */
  const effectiveSelectedContextLineIds = useMemo<ReadonlySet<string>>(() => {
    if (openContexts.length === 0) return EMPTY_SELECTED_SET;
    if (!hasAnyFilter(filterState)) return EMPTY_SELECTED_SET;
    const ids = new Set<string>();
    for (const ctx of openContexts) {
      const selected = lines.find((l) => l.id === ctx.selectedLineId);
      if (!selected) continue;
      if (lineMatchesFilter(selected, filterState)) {
        ids.add(ctx.selectedLineId);
      }
    }
    return ids;
  }, [openContexts, filterState, lines]);

  /**
   * Toggle a View Context window on the given line.
   *
   * Only available on filter-matched (non-context-only)
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
   * expand or collapse around it. The most recently selected context
   * line is always the scroll anchor: each toggle resets
   * `anchorLineId` to the line just acted on, so a subsequent filter
   * dispatch falls through to the right reference.
   */
  const handleToggleContext = useStableCallback((lineId: string) => {
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

    // Slow mode persists through the longest line transition plus a
    // layout-settle buffer; auto-clears once the budget elapses.
    setTransitionMode("slow");
    if (slowModeTimeoutRef.current !== null)
      clearTimeout(slowModeTimeoutRef.current);
    slowModeTimeoutRef.current = window.setTimeout(() => {
      setTransitionMode("instant");
      slowModeTimeoutRef.current = null;
    }, COMPENSATION_DURATION_MS);

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
  });

  /**
   * Grow an open context's range by one fixed step (CONTEXT_RANGE_STEP).
   *
   * Single input path: shift+e keyboard shortcut, retargeted at the
   * most-recently-opened context. The keyboard binding is the only
   * growth path; the click target on a row toggles the context, it
   * doesn't expand it.
   *
   * Strict semantics: no-op if the line has no open context, and no-op
   * at the file boundary (when the window already covers all lines on
   * both sides of the anchor). The boundary signal is also surfaced
   * to the surrounding chrome so the user knows expansion has nowhere
   * to go.
   *
   * Switches to "slow" transition mode for the duration of the resize
   * so the newly-revealed lines at the window's edges animate in,
   * matching the choreography of `e` itself. Anchor line is the line
   * being acted on — the user wants their reading position pinned
   * while the surrounding region grows.
   */
  const expandContextRange = useCallback(
    (lineId: string) => {
      const existingIndex = openContexts.findIndex(
        (c) => c.selectedLineId === lineId,
      );
      if (existingIndex === -1) return;

      const anchorIndex = lines.findIndex((l) => l.id === lineId);
      const currentRange = openContexts[existingIndex].range;
      // Boundary: window already covers both file edges from the
      // anchor. See isAtFileBoundary for the "wait for both ends"
      // rationale.
      if (isAtFileBoundary(anchorIndex, currentRange, lines.length)) return;
      const nextRange = currentRange + CONTEXT_RANGE_STEP;

      // Successful expansion → bump the pulse key so the matching
      // keyboard-hint entry remounts and replays its mount animation.
      // Gives the user a visible flash on each press, including
      // consecutive presses where the entry's label is identical.
      setLegendPulseKey((k) => k + 1);

      const anchor = captureAnchor(lineId);

      if (lineId !== anchorLineId) setAnchorLineId(lineId);

      setTransitionMode("slow");
      if (slowModeTimeoutRef.current !== null)
        clearTimeout(slowModeTimeoutRef.current);
      slowModeTimeoutRef.current = window.setTimeout(() => {
        setTransitionMode("instant");
        slowModeTimeoutRef.current = null;
      }, COMPENSATION_DURATION_MS);

      setOpenContexts((current) =>
        current.map((c, i) =>
          i === existingIndex ? { ...c, range: nextRange } : c,
        ),
      );

      if (anchor) startCompensation(anchor);
    },
    [openContexts, lines, anchorLineId, captureAnchor, startCompensation],
  );

  const handleExpandContext = useStableCallback(expandContextRange);

  /**
   * Focus persistence rule: the *saved* focus (`focusedLineId`) is
   * what the user explicitly set; the *effective* focus is what
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

    const focusedIndex = derivedLines.findIndex((l) => l.id === focusedLineId);
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
   * Keyboard handler attached to the listbox <ul>. Receives
   * KeyboardEvents only when the list is focused (Tab into it, or any
   * descendant has focus and the event bubbles up).
   *
   * Owns visible-line navigation (next/prev/first/last) and deploy-
   * boundary navigation (prev/next). Arrow keys are first-class
   * equivalents of the Vim-style letter pair for discoverability;
   * the lowercase-top / shift-bottom convention follows the Vim/less
   * pattern. The bindings registered here must match the user-facing
   * shortcut registry — that registry is the source of truth.
   *
   * Visible lines are the navigable set for line nav; deploy
   * boundaries are their own set for boundary nav. A hidden line is
   * functionally not there for navigation.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      // Ignore browser-claimed modifier combos. cmd/ctrl + j is a
      // downloads shortcut on Chrome; alt-prefixed keys are reserved
      // for OS/browser bindings on most platforms.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const { key, shiftKey } = event;

      // Only a small set of shifted keys are claimed by this handler;
      // everything else with a shift modifier bails. Keeps the no-shift
      // default close to universal and leaves shift+letter free for
      // future bindings without a case-by-case audit.
      if (shiftKey && key !== "G" && key !== "g" && key !== "E" && key !== "e")
        return;

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
      const isToggleContext = !shiftKey && (key === "e" || key === "Enter");
      const isExpandContext = shiftKey && (key === "E" || key === "e");

      if (
        !isNext &&
        !isPrev &&
        !isFirst &&
        !isLast &&
        !isPrevBoundary &&
        !isNextBoundary &&
        !isToggleContext &&
        !isExpandContext
      ) {
        return;
      }

      // Context toggle on the focused line. Reuses the same handler
      // that powers the click path — same gate (requires a filter
      // active, not allowed on dimmed lines), same append/remove
      // semantics, same scroll compensation. The keyboard binding
      // is just a different input path into the same pipeline.
      //
      // Both `e` and Enter map here. Enter mirrors a click on the
      // focused line — accessible default for keyboard-only users
      // who think of Enter as the universal "activate this thing"
      // key.
      //
      // Bails silently if no line is focused — the binding has no
      // target, but we still preventDefault so the bare `e` / Enter
      // don't leak through to anything else.
      if (isToggleContext) {
        event.preventDefault();
        if (effectiveFocusedLineId) {
          handleToggleContext(effectiveFocusedLineId);
        }
        return;
      }

      // shift+e expands the most-recently-opened context by one fixed
      // step. Targets the most-recent (last in `openContexts` — array
      // order is recency, see comment on the state declaration) rather
      // than the focused line:
      //
      //   - The focused line and the context-anchor line are
      //     independent — a user can navigate focus elsewhere while a
      //     context stays anchored. Expanding focus would silently
      //     resize the wrong window or, more often, no-op because the
      //     focused line has no open context.
      //   - "Expand the thing I just opened" matches the user's
      //     mental model of shift+e as a continuation of the e action
      //     they performed a moment ago.
      //
      // Strict: no-op when no contexts are open. The handler is also
      // a no-op at the file boundary (see expandContextRange).
      if (isExpandContext) {
        event.preventDefault();
        const mostRecent = openContexts[openContexts.length - 1];
        if (mostRecent) {
          handleExpandContext(mostRecent.selectedLineId);
        }
        return;
      }

      // Boundary navigation has its own filter (deploy boundaries
      // only) and direction logic — separate it out from the
      // visible-line navigation path.
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
            const bi = derivedLines.findIndex((l) => l.id === boundaries[i].id);
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
      // visible line and expects line nav to advance from there.
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
    [
      derivedLines,
      effectiveFocusedLineId,
      openContexts,
      handleToggleContext,
      handleExpandContext,
    ],
  );

  /**
   * Document-level shortcuts that must work regardless of where focus
   * currently is on the page:
   *
   *   Esc  — clear all open contexts (or active filter)
   *   ?    — open the shortcut surface
   *
   * The listbox-level handler covers in-list bindings; splitting them
   * this way keeps each handler responsible for one focus context —
   * no "is the listbox focused?" branching inside individual bindings.
   *
   * Both bail when `event.defaultPrevented` is set so a dialog
   * primitive consuming its own Escape doesn't double-fire as "clear
   * contexts." Closeable surfaces consume their own dismiss before a
   * global-clear runs — this is what lets the Esc cascade compose for
   * free.
   *
   * `?` is shift+/ on US keyboards. Both `event.key === "?"` and the
   * shift+/ pair land here; we accept either form for robustness
   * across keyboard layouts and testing tools.
   *
   * Esc cascades through:
   *   shortcut surface open → close it     (owned by the dialog)
   *   any context open      → close all    (this handler)
   *   any filter active     → clear filter (this handler)
   *   else                  → no-op
   *
   * The filter-clear step gives Esc something to do whenever the
   * user has actively narrowed the view, matching the surrounding
   * keyboard hint that advertises it.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        if (openContexts.length > 0) {
          event.preventDefault();
          setOpenContexts([]);
          return;
        }
        if (hasAnyFilter(filterState)) {
          event.preventDefault();
          handleClearFilter();
          return;
        }
        return;
      }

      // ? opens the shortcut surface. Open-only — dismissal is owned
      // by the dialog primitive (Esc / click-outside). Bail if it's
      // already open so we don't redundantly setState.
      const isQuestionMark =
        event.key === "?" || (event.key === "/" && event.shiftKey);
      if (isQuestionMark) {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        if (sheetOpen) return;
        event.preventDefault();
        setSheetOpen(true);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openContexts.length, sheetOpen, filterState, handleClearFilter]);

  /**
   * Build the contextual hint items rendered above the list. Items
   * appear in left-to-right priority order, gated on whether the
   * corresponding action is currently meaningful. Each item is
   * clickable; the keycaps document the keyboard equivalent. A help
   * fallback shows only when no stateful action is available, so the
   * surface reads as "here's what to do next" once anything is.
   *
   * Reads the most-recent context's *saved* state from `openContexts`
   * (not the filter-gated set): a saved context whose accent is
   * suppressed by a filter change is still the one expansion would
   * target if pressed, so the right hint should still surface.
   */
  const legendItems = useMemo<readonly LegendItem[]>(() => {
    const items: LegendItem[] = [];

    // Whether the focused line is the anchor of a saved open context.
    // Captures the same intent as the filter-gated set — "would the
    // toggle action close, or open?"
    const focusedIsAnchor =
      effectiveFocusedLineId !== null &&
      openContexts.some((c) => c.selectedLineId === effectiveFocusedLineId);

    // Recompute the toggle-context gate on the focused line. Local
    // copy of the per-row gate so we don't have to thread it back up
    // through props.
    const focusedLine = effectiveFocusedLineId
      ? derivedLines.find((l) => l.id === effectiveFocusedLineId)
      : null;
    const focusedCanToggle =
      hasAnyFilter(filterState) &&
      !!focusedLine?.isVisible &&
      !focusedLine.isDimmed;

    // Expansion entry — leftmost when applicable, so the growth action
    // is the first thing the user reads.
    const mostRecent = openContexts[openContexts.length - 1];
    if (mostRecent) {
      const anchorIndex = lines.findIndex(
        (l) => l.id === mostRecent.selectedLineId,
      );
      const atBoundary = isAtFileBoundary(
        anchorIndex,
        mostRecent.range,
        lines.length,
      );
      if (!atBoundary) {
        items.push({
          keys: ["Shift", "E"],
          label: "Expand context",
          onClick: () => handleExpandContext(mostRecent.selectedLineId),
          pulseKey: legendPulseKey,
        });
      }
    }

    // Toggle-on-focused entry — middle slot. Label flips between
    // open and close depending on whether the focused line is already
    // a context anchor.
    if (effectiveFocusedLineId && (focusedCanToggle || focusedIsAnchor)) {
      items.push({
        keys: ["E"],
        label: focusedIsAnchor ? "Hide context" : "View context",
        ariaLabel: focusedIsAnchor
          ? "Hide context on focused line"
          : "View context on focused line",
        onClick: () => handleToggleContext(effectiveFocusedLineId),
      });
    }

    // Dismiss entry — rightmost. Cascade priority drives the label
    // and behavior; same precedence as the document-level Esc handler
    // so the mouse path and the keyboard binding stay in sync.
    if (openContexts.length > 0) {
      items.push({
        keys: ["Esc"],
        label: "Close",
        ariaLabel: "Close all open contexts",
        onClick: () => setOpenContexts([]),
      });
    } else if (hasAnyFilter(filterState)) {
      items.push({
        keys: ["Esc"],
        label: "Clear filter",
        ariaLabel: "Clear active filter",
        onClick: handleClearFilter,
      });
    }

    // Fallback to the help entry only when nothing actionable has
    // been pushed — the surface should always say *something*.
    if (items.length === 0) {
      items.push({
        keys: ["?"],
        label: "for all shortcuts",
        ariaLabel: "Open keyboard shortcuts",
        onClick: () => setSheetOpen(true),
      });
    }

    return items;
  }, [
    openContexts,
    lines,
    derivedLines,
    filterState,
    effectiveFocusedLineId,
    handleToggleContext,
    handleExpandContext,
    handleClearFilter,
    legendPulseKey,
  ]);

  return (
    // prefers-reduced-motion is honored entirely in CSS — no JS
    // bridge needed.
    <div className={styles.explorer}>
      <Legend items={legendItems} />
      <ScenarioChips state={filterState} dispatch={dispatchFilter} />
      <LogList
        lines={derivedLines}
        viewportRef={viewportRef}
        onToggleContext={handleToggleContext}
        onLineFocus={setFocusedLineId}
        onKeyDown={handleKeyDown}
        selectedContextLineIds={effectiveSelectedContextLineIds}
        focusedLineId={effectiveFocusedLineId}
        streamedLineIds={streamedLineIds}
        hasAnyFilter={hasAnyFilter(filterState)}
        transitionMode={transitionMode}
      />
      <UnreadStrip count={unreadCount} onClick={handleScrollToBottom} />
      <ShortcutSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
