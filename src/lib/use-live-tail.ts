"use client";

import { useEffect, useRef, useState } from "react";

import type { LiveTailSeedEntry } from "@/lib/mock-logs";
import type { LogLine } from "@/types/log";

/**
 * Streams a hand-curated seed of log lines into the rendered feed,
 * one at a time, on the cadence baked into each seed entry's
 * `delayMs`. Returns the live array (initial + emitted-so-far) plus
 * the count of newly-streamed-since-mount lines.
 *
 * Lines append at the bottom on a hand-tuned cadence — bursts of
 * activity separated by quiet periods, modelling realistic traffic.
 *
 * ### Why a hook (vs inline in LogExplorer)
 *
 * LogExplorer owns a lot already (filter state, focus model, anchor
 * mechanics, scroll compensation, shortcut sheet). Pulling the
 * streaming engine into its own hook keeps each concern focused
 * and makes the streaming logic independently testable.
 *
 * ### State shape
 *
 * `lines`     — the combined array (initial + streamed). What
 *               LogExplorer feeds to the derive pipeline.
 * `freshIds`  — set of ids that streamed in *after* mount. The list
 *               component reads this to decide which lines should
 *               animate-in (vs. render at target values for the
 *               initial fixture). Once a line is in `freshIds` it
 *               stays — no need to clean up; the CSS @starting-style
 *               only applies the first time the row is inserted.
 *
 * ### Cadence model
 *
 * Each tick: schedule the next entry via `setTimeout(delayMs)` after
 * appending the previous. Single timer in flight at any moment;
 * unmount cleanup cancels it. delayMs values are wall-clock,
 * decoupled from the seed's mock timestamps (which continue the
 * story arc deterministically and are independent of when streaming
 * started).
 *
 * ### When does streaming stop?
 *
 * When the seed is exhausted — the engine simply stops. No looping,
 * no procedural generation. For a portfolio prototype, finite +
 * deterministic + memory-bounded.
 */
export function useLiveTail(
  initial: readonly LogLine[],
  seed: readonly LiveTailSeedEntry[],
): {
  lines: readonly LogLine[];
  /**
   * Ids of lines that arrived via streaming (i.e. not in the
   * initial fixture). Drives mount-time animation in LogList — lines
   * in this set get `initial={{ height: 0, opacity: 0 }}` so they
   * animate in; lines not in the set get `initial={false}` to skip
   * the initial-page-load mass-animation.
   */
  freshIds: ReadonlySet<string>;
} {
  const [lines, setLines] = useState<readonly LogLine[]>(initial);
  // freshIds tracks streamed line ids so LogList knows which mounts
  // should animate-in (vs. the initial fixture, which mounts at
  // target values without animation). State (not ref) so React 19's
  // refs-during-render rule stays happy and the Set reference
  // updates on each emission. The Set grows monotonically — once a
  // line is in here, it stays. The render cost is negligible
  // because LogList re-renders on every lines update anyway.
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Track the seed index in a ref so the timer-chain effect doesn't
  // restart from the beginning on every render. The effect reads the
  // current cursor; when it ticks, it advances and schedules the
  // next.
  const cursorRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Drip-feed: each step appends the next seed entry, then
    // schedules the one after.
    const tick = () => {
      const idx = cursorRef.current;
      if (idx >= seed.length) {
        timerRef.current = null;
        return;
      }
      const entry = seed[idx];
      // Strip delayMs before appending — the rendered line shouldn't
      // carry it. Just the LogLine portion makes it into state.
      const { delayMs: _delayMs, ...lineOnly } = entry;
      void _delayMs;

      setLines((prev) => [...prev, lineOnly as LogLine]);
      setFreshIds((prev) => {
        const next = new Set(prev);
        next.add(entry.id);
        return next;
      });

      cursorRef.current = idx + 1;
      const next = seed[cursorRef.current];
      if (next) {
        timerRef.current = window.setTimeout(tick, next.delayMs);
      } else {
        timerRef.current = null;
      }
    };

    // Kick off the chain with the first entry's delay. Fires AFTER
    // the initial render so the user has a beat to orient.
    if (seed.length > 0 && timerRef.current === null && cursorRef.current === 0) {
      timerRef.current = window.setTimeout(tick, seed[0].delayMs);
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // The seed is a stable module-level constant in production usage;
    // including it in deps would re-arm the timer on every parent
    // render if the caller passes a non-stable reference. This effect
    // is intentionally fire-once-on-mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { lines, freshIds };
}
