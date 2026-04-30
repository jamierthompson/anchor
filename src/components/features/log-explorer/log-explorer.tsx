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

import {
  ADD_FILTER_TRIGGER_ID,
  FilterBar,
} from "@/components/features/filter-bar/filter-bar";
import { LogList } from "@/components/features/log-list/log-list";
import { NewLinesPill } from "@/components/features/log-list/new-lines-pill";
import {
  ShortcutSheet,
  ShortcutSheetTrigger,
} from "@/components/features/shortcut-sheet/shortcut-sheet";
import { liveTailSeed } from "@/lib/mock-logs";
import { useLiveTail } from "@/lib/use-live-tail";
import { useStableCallback } from "@/lib/use-stable-callback";
import {
  DEFAULT_CONTEXT_RANGE,
  nextContextRange,
  previousContextRange,
  type OpenContext,
} from "@/lib/context-state";
import { formatLineForCopy } from "@/lib/copy-lines";
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
 * Stable empty map returned by `effectiveSelectedContextRangesById`
 * when no accent should render. Reusing one instance keeps the prop
 * reference stable across renders so LogList doesn't re-render
 * unnecessarily.
 */
const EMPTY_SELECTED_MAP: ReadonlyMap<string, number> = new Map();

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
export function LogExplorer({
  lines: initialLines,
}: {
  lines: readonly LogLine[];
}) {
  // Live-tail simulation streams seed entries on a hand-curated
  // cadence (spec §10.2). `lines` is the combined initial fixture +
  // streamed-so-far entries; `freshIds` is the set of streamed line
  // ids, which LogList uses to gate per-line mount-time animation
  // (animate from height: 0 only for streamed lines, not the
  // initial fixture).
  const { lines, freshIds: streamedLineIds } = useLiveTail(
    initialLines,
    liveTailSeed,
  );

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
  const [openContexts, setOpenContexts] = useState<readonly OpenContext[]>([]);

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

  // Open state for the shortcut sheet (spec §9.7). Lifted to
  // LogExplorer so the document-level `?` keyboard handler — which
  // can't sit inside the Dialog tree — can flip it. Spec §7 says
  // the sheet doesn't toggle on `?` (open-only); Esc / click-outside
  // do the closing via Radix Dialog's native behavior.
  const [sheetOpen, setSheetOpen] = useState(false);

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
   * anchor stay fixed *during* the expand/collapse.
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
   * Unread count for the "↓ N new lines" pill (spec §9.8). Increments
   * when a streamed line arrives AND the user is scrolled away from
   * the bottom. Resets to 0 when:
   *   - The user clicks the pill (smooth-scrolls to bottom + reset).
   *   - The user organically scrolls to the bottom of the list (the
   *     scroll-listener effect below detects this).
   * Filter-hidden streamed lines aren't counted — the pill only
   * surfaces lines the user could currently see if they scrolled.
   */
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * Live-tail line-arrival handler (spec §9.8 / §10.2). Two branches
   * on every append, gated by whether the user is at the bottom:
   *
   *   - At-bottom → kick off `startStickToBottom`. As Motion grows
   *     the new line's height from 0 → auto, the document grows
   *     underneath, and the rAF loop tracks `scrollHeight -
   *     clientHeight` each frame so the user stays glued to the
   *     most-recent line.
   *   - Scrolled-up → increment `unreadCount` so the pill surfaces.
   *     The newly-appended line is invisible-below-the-fold; the
   *     pill is the user's "I'm missing things" signal.
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
    if (isAtBottom()) {
      startStickToBottom();
    } else {
      setUnreadCount((c) => c + delta);
    }
  }, [lines.length, isAtBottom, startStickToBottom]);

  /**
   * Reset the unread count when the user organically scrolls to the
   * bottom of the list (without clicking the pill). Catches the case
   * where the user manually drags the scrollbar to bottom — pill
   * should disappear, count should reset.
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
   * Pill click handler — smooth-scroll to bottom + reset count.
   * Uses native `scrollTo({ behavior: "smooth" })` rather than the
   * rAF compensation loop because this is a USER-initiated jump
   * (vs. animation tracking). Modern browsers handle smooth scroll
   * via the platform's scroll engine, which composites correctly
   * with whatever Motion animations are in flight.
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
   * Map of line id → currently-open context's ±range. Single source of
   * truth for both the selection-accent visual (left border + active-
   * state Anchor icon in the action row) AND the per-line action row
   * (Expand / Less buttons gate on `range`).
   *
   * Open contexts are preserved across filter changes so that
   * loosening a filter restores the saved selection in place. But the
   * accent should only render while the selection is *meaningful* — at
   * least one filter active AND the selected line still matches. When
   * either part of the gate fails for an entry, the saved state stays
   * put behind the scenes but its accent disappears.
   */
  const effectiveSelectedContextRangesById = useMemo<
    ReadonlyMap<string, number>
  >(() => {
    if (openContexts.length === 0) return EMPTY_SELECTED_MAP;
    if (!hasAnyFilter(filterState)) return EMPTY_SELECTED_MAP;
    const byId = new Map<string, number>();
    for (const ctx of openContexts) {
      const selected = lines.find((l) => l.id === ctx.selectedLineId);
      if (!selected) continue;
      if (lineMatchesFilter(selected, filterState)) {
        byId.set(ctx.selectedLineId, ctx.range);
      }
    }
    return byId;
  }, [openContexts, filterState, lines]);

  // Stable identity so the memoized LogListItem doesn't re-render on
  // every state change that touches dispatchFilter's deps. The latest
  // closure (and therefore the latest dispatchFilter) is read at call
  // time. See use-stable-callback.ts for the full rationale.
  const handleFilterToggle = useStableCallback(
    (target: FilterToggleTarget, sourceLineId: string) =>
      dispatchFilter(actionForTarget(target), sourceLineId),
  );

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
   * expand or collapse around it. This is exactly spec §4's anchor-
   * priority rule ("most recently selected is the scroll anchor"):
   * each toggle resets `anchorLineId` to the line just acted on, so a
   * subsequent filter dispatch falls through to the right reference.
   */
  const handleToggleContext = useStableCallback(
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
  );

  /**
   * Step an open context's range up or down by one cycle entry.
   *
   * Three input paths bind to this:
   *   - `shift+e` keyboard shortcut → step="next" (wraps ±100 → ±20).
   *   - "Expand context" icon button → step="next" (no wrap; button
   *     hides at ±100).
   *   - "Less context" icon button → step="prev" (no wrap; button
   *     hides at ±20).
   *
   * Strict semantics: no-op if the line has no open context. "Open a
   * context" (e / Anchor button) and "resize a context" (shift+e /
   * cycle buttons) are conceptually separate — implicit-open would
   * conflate them and obscure the default ±20 starting point.
   *
   * Switches to "slow" transition mode for the duration of the
   * resize so the newly-revealed (or hidden) lines at the window's
   * edges animate in, matching the choreography of `e` itself.
   * Anchor line is the line being acted on — the user wants their
   * reading position pinned while the surrounding region grows or
   * shrinks.
   */
  const stepContextRange = useCallback(
    (lineId: string, step: "next" | "prev") => {
      const existingIndex = openContexts.findIndex(
        (c) => c.selectedLineId === lineId,
      );
      if (existingIndex === -1) return;

      const anchor = captureAnchor(lineId);

      if (lineId !== anchorLineId) setAnchorLineId(lineId);

      setTransitionMode("slow");
      if (slowModeTimeoutRef.current !== null)
        clearTimeout(slowModeTimeoutRef.current);
      slowModeTimeoutRef.current = window.setTimeout(() => {
        setTransitionMode("instant");
        slowModeTimeoutRef.current = null;
      }, 600);

      setOpenContexts((current) =>
        current.map((c, i) =>
          i === existingIndex
            ? {
                ...c,
                range:
                  step === "next"
                    ? nextContextRange(c.range)
                    : previousContextRange(c.range),
              }
            : c,
        ),
      );

      if (anchor) startCompensation(anchor);
    },
    [openContexts, anchorLineId, captureAnchor, startCompensation],
  );

  // shift+e (wraps via nextContextRange) and the "Expand context"
  // icon button both call the same handler — the button is hidden at
  // ±100 so it never fires at that endpoint, while shift+e wraps
  // around to ±20. Both paths into one handler keeps invariants
  // consolidated.
  const handleExpandContext = useStableCallback((lineId: string) =>
    stepContextRange(lineId, "next"),
  );

  const handleLessContext = useStableCallback((lineId: string) =>
    stepContextRange(lineId, "prev"),
  );

  /**
   * Copy a plain-text representation of a single line to the
   * clipboard. Bound to the Copy icon button and the `c` keyboard
   * shortcut.
   *
   * Format: ISO timestamp + instance + level (when WARN/ERROR) +
   * message + request id (when present). Mirrors what a developer
   * would paste into a bug report — enough context to identify the
   * line without needing to share the whole UI.
   *
   * Deploy-boundary lines copy their `message` as-is.
   *
   * Uses navigator.clipboard.writeText. Best-effort: on browsers that
   * deny clipboard access (older or non-secure contexts), silently
   * no-ops. The fallback case is rare in modern dev environments and
   * a clipboard error UI isn't worth its weight in a prototype.
   */
  const handleCopyLine = useStableCallback((lineId: string) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    const text = formatLineForCopy(line);
    void navigator.clipboard?.writeText?.(text);
  });

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

      // Two shifted keys are accepted: shift+g (last visible line) and
      // shift+e (cycle context size). Everything else with a shift
      // modifier bails — keeps the no-shift default close to universal
      // and leaves shift+letter free for future bindings without a
      // case-by-case audit.
      if (shiftKey && key !== "G" && key !== "g" && key !== "E" && key !== "e")
        return;

      const isNext = !shiftKey && (key === "j" || key === "ArrowDown");
      const isPrev = !shiftKey && (key === "k" || key === "ArrowUp");
      const isFirst = !shiftKey && key === "g";
      // Accept both forms — `key: "G"` is what most browsers fire for
      // shift+g on US keyboards, but some testing tools and non-US
      // layouts fire `key: "g"` with shiftKey true. Handling both
      // makes the binding robust without changing the user-facing
      // contract. Same dual check applies to shift+e below.
      const isLast = shiftKey && (key === "G" || key === "g");
      const isPrevBoundary = !shiftKey && key === "[";
      const isNextBoundary = !shiftKey && key === "]";
      const isToggleContext = !shiftKey && key === "e";
      const isCycleContextRange = shiftKey && (key === "E" || key === "e");
      const isCopyLine = !shiftKey && key === "c";

      if (
        !isNext &&
        !isPrev &&
        !isFirst &&
        !isLast &&
        !isPrevBoundary &&
        !isNextBoundary &&
        !isToggleContext &&
        !isCycleContextRange &&
        !isCopyLine
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

      // shift+e cycles the range of an open context on the focused
      // line. Strict: no-op when the focused line has no context
      // open (handler enforces this internally).
      if (isCycleContextRange) {
        event.preventDefault();
        if (effectiveFocusedLineId) {
          handleExpandContext(effectiveFocusedLineId);
        }
        return;
      }

      // c — copy the focused line to clipboard. Mirrors the action
      // row's Copy button so every visible action has a keyboard
      // equivalent. Bails silently when no line is focused.
      if (isCopyLine) {
        event.preventDefault();
        if (effectiveFocusedLineId) {
          handleCopyLine(effectiveFocusedLineId);
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
    [
      derivedLines,
      effectiveFocusedLineId,
      handleToggleContext,
      handleExpandContext,
      handleCopyLine,
    ],
  );

  /**
   * Document-level shortcuts. Three bindings need to work regardless
   * of where focus currently is on the page (GitHub / Slack / Linear
   * convention):
   *
   *   /    — focus the "+ Add filter" trigger
   *   Esc  — clear all open contexts (spec §7 precedence #3)
   *   ?    — open the shortcut sheet
   *
   * The listbox-level handler covers in-list bindings (j/k/g/G/[/]/e/
   * shift+e/c). Splitting them this way keeps each handler responsible
   * for one focus context — no "is the listbox focused?" branching
   * inside individual bindings.
   *
   * All three bail when `event.defaultPrevented` is set so Radix
   * Popover / Dialog primitives handling their own Escape (filter
   * popover, shortcut sheet itself) don't double-fire as "clear
   * contexts." Closeable surfaces consume their own dismiss before a
   * global-clear runs — this is what makes the Esc precedence
   * cascade compose for free.
   *
   * `/` additionally bails when focus is inside an input/textarea/
   * contenteditable so typing a literal `/` in a filter input later
   * (e.g. if a search box appears) doesn't get intercepted.
   *
   * `?` is shift+/ on US keyboards. Both `event.key === "?"` and the
   * shift+/ pair land here; we accept either form for robustness
   * across keyboard layouts and testing tools (same dual-form check
   * we use for shift+g and shift+e in the listbox handler).
   *
   * Esc precedence per spec §7:
   *   1. shortcut sheet open → close it     (handled by Radix Dialog)
   *   2. kebab menu open → close it          (no kebab — task #8 redesigned)
   *   3. any context open → close all       (this handler)
   *   4. else: no-op
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        if (openContexts.length === 0) return;
        event.preventDefault();
        setOpenContexts([]);
        return;
      }

      if (event.key === "/" && !event.shiftKey) {
        const target = event.target as HTMLElement | null;
        // Don't intercept while the user is typing in any text input.
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        const trigger = document.getElementById(ADD_FILTER_TRIGGER_ID);
        if (!trigger) return;
        event.preventDefault();
        trigger.focus();
        return;
      }

      // ? opens the shortcut sheet. Open-only — closing happens via
      // Esc / click-outside / the modal's close button (all handled
      // by Radix Dialog). Bail if the sheet is already open so we
      // don't redundantly setState.
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
  }, [openContexts.length, sheetOpen]);

  return (
    // prefers-reduced-motion is honored entirely in CSS now — see the
    // @media block in log-list.module.css. No JS bridge needed.
    <div className={styles.explorer}>
      <FilterBar state={filterState} dispatch={dispatchFilter} />
      <LogList
        lines={derivedLines}
        viewportRef={viewportRef}
        onFilterToggle={handleFilterToggle}
        onToggleContext={handleToggleContext}
        onExpandContext={handleExpandContext}
        onLessContext={handleLessContext}
        onCopyLine={handleCopyLine}
        onLineFocus={setFocusedLineId}
        onKeyDown={handleKeyDown}
        selectedContextRangesById={effectiveSelectedContextRangesById}
        focusedLineId={effectiveFocusedLineId}
        streamedLineIds={streamedLineIds}
        hasAnyFilter={hasAnyFilter(filterState)}
        transitionMode={transitionMode}
      />
      <NewLinesPill count={unreadCount} onClick={handleScrollToBottom} />
      <ShortcutSheetTrigger onOpen={() => setSheetOpen(true)} />
      <ShortcutSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
