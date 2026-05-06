"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Returns a callback whose identity NEVER changes across renders, but
 * whose body always sees the most-recent values of any state/props it
 * closes over. Same shape as the (still-experimental) `useEffectEvent`
 * API. Use when handing a callback to a memoized child where reference
 * stability is the goal.
 *
 * ### Motivating case
 *
 * A parent that exposes per-row callbacks to a memoized list item
 * commonly sees those callbacks churn — useCallback deps include
 * state that changes mid-interaction (a derived list rebuilt every
 * render, a transition flag that flips during the action, a window
 * collection that updates on every toggle). The churn happens at
 * exactly the moments the row memo needs stable references.
 *
 * Wrapping with `useStableCallback` gives a stable outer reference
 * that always delegates to the latest closure. The memo bites; the
 * row's body still sees up-to-date state when the callback runs.
 *
 * Doubles as a static-analysis escape hatch: tools that flag refs
 * being read through several layers of useCallback indirection see
 * this as an opaque wrapper instead.
 *
 * ### Tradeoff
 *
 * The function can no longer be passed to dep arrays that expect
 * change detection — by design, it never changes. Don't use this
 * for callbacks whose identity is meaningful elsewhere (e.g., as a
 * `useEffect` dep where you want the effect to re-run on closure
 * change).
 *
 * ### Implementation note
 *
 * `useLayoutEffect` (not `useEffect`) so the ref updates synchronously
 * after commit, before any browser paint. Event handlers can fire
 * between render and effect; the layout-effect timing ensures they
 * always see the latest closure.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback(
    (...args: Parameters<T>) => ref.current(...args),
    [],
  ) as T;
}
