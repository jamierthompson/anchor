"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Returns a callback whose identity NEVER changes across renders, but
 * whose body always sees the most-recent values of any state/props it
 * closes over.
 *
 * This is the standard `useEffectEvent` polyfill — same shape as the
 * (still-experimental) React API. Use when handing a callback to a
 * memoized child where reference stability is the goal.
 *
 * ### Motivating case
 *
 * `LogExplorer` exposes per-row callbacks (`handleToggleContext`,
 * `handleExpandContext`) to the memoized `LogListItem`. Their
 * `useCallback` deps include state that changes mid-interaction —
 * `derivedLines` is a new array every render, `transitionMode` flips
 * during a context toggle, `openContexts` updates on every toggle. So
 * the callback identities churn at exactly the moments the row memo
 * needs them stable, and every row re-renders on every interaction.
 *
 * Wrapping with `useStableCallback` gives a stable outer reference
 * that always delegates to the latest closure. The memo bites; the
 * row's body still sees up-to-date state when the callback runs.
 *
 * It also doubles as a react-compiler escape hatch: the analyzer
 * conservatively flags `useCallback` closures that transitively read
 * refs through several layers of indirection. Wrapping in
 * `useStableCallback` hides that call graph behind a stable opaque
 * wrapper.
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
 * between render and effect; `useLayoutEffect` ensures they always
 * see the latest closure.
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
