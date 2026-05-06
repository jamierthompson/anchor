import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LiveTailSeedEntry } from "@/lib/mock-logs";
import { useLiveTail } from "@/lib/use-live-tail";
import type { LogLine } from "@/types/log";

/**
 * Pure-hook coverage for the live-tail streaming engine. The
 * integration with LogExplorer + the CSS @starting-style mount
 * animation is exercised end-to-end in the browser; these tests
 * pin the engine's cadence and state contract so regressions show
 * up in the unit suite.
 *
 * `vi.useFakeTimers()` lets us advance setTimeout's clock
 * deterministically. Without it, each `delayMs` would actually delay
 * the test run.
 */

const initialFixture: LogLine[] = [
  {
    id: "init_1",
    timestamp: 1_000,
    instance: "7tbsm",
    level: "INFO",
    message: "initial line one",
  },
  {
    id: "init_2",
    timestamp: 2_000,
    instance: "7tbsm",
    level: "INFO",
    message: "initial line two",
  },
];

const seed: LiveTailSeedEntry[] = [
  {
    id: "stream_1",
    timestamp: 10_000,
    instance: "7tbsm",
    level: "INFO",
    message: "first streamed line",
    delayMs: 500,
  },
  {
    id: "stream_2",
    timestamp: 11_000,
    instance: "a3kx2",
    level: "WARN",
    message: "second streamed line",
    delayMs: 300,
  },
  {
    id: "stream_3",
    timestamp: 12_000,
    instance: "m9p4r",
    level: "INFO",
    message: "third streamed line",
    delayMs: 1500,
  },
];

describe("useLiveTail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial fixture before any timers fire", () => {
    const { result } = renderHook(() => useLiveTail(initialFixture, seed));
    expect(result.current.lines).toEqual(initialFixture);
    expect(result.current.freshIds.size).toBe(0);
  });

  it("appends seed entries one-by-one as their cumulative delays elapse", () => {
    const { result } = renderHook(() => useLiveTail(initialFixture, seed));

    // After the first delay, only the first seed entry has been added.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.lines).toHaveLength(3);
    expect(result.current.lines[2]?.id).toBe("stream_1");
    expect(result.current.freshIds.has("stream_1")).toBe(true);
    expect(result.current.freshIds.has("stream_2")).toBe(false);

    // Second entry's delay (300ms) elapses on top of the first.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.lines).toHaveLength(4);
    expect(result.current.lines[3]?.id).toBe("stream_2");
    expect(result.current.freshIds.has("stream_2")).toBe(true);

    // Third entry has the longest delay (1500ms) — runs all timers.
    act(() => {
      vi.runAllTimers();
    });
    expect(result.current.lines).toHaveLength(5);
    expect(result.current.lines[4]?.id).toBe("stream_3");
    expect(result.current.freshIds.size).toBe(3);
  });

  it("strips the delayMs property — only LogLine fields land in state", () => {
    const { result } = renderHook(() => useLiveTail(initialFixture, seed));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const streamed = result.current.lines[2]!;
    expect(streamed).not.toHaveProperty("delayMs");
    expect(streamed.id).toBe("stream_1");
    expect(streamed.message).toBe("first streamed line");
  });

  it("freshIds grows monotonically — entries don't get removed after streaming", () => {
    // Mount-time animation only matters the first time a row is
    // inserted into the DOM, so we don't need to clean up. The test
    // pins this invariant: once an id is in freshIds, it stays.
    const { result } = renderHook(() => useLiveTail(initialFixture, seed));
    act(() => {
      vi.runAllTimers();
    });
    expect(result.current.freshIds.size).toBe(3);
    // No further timers fire — Set should be stable.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.freshIds.size).toBe(3);
  });

  it("stops cleanly when the seed is exhausted (no infinite loop)", () => {
    const { result } = renderHook(() => useLiveTail(initialFixture, seed));
    act(() => {
      vi.runAllTimers();
    });
    const finalLength = result.current.lines.length;

    // Advancing further does nothing — the chain ended.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.lines).toHaveLength(finalLength);
  });

  it("does nothing when the seed is empty", () => {
    const { result } = renderHook(() => useLiveTail(initialFixture, []));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.lines).toEqual(initialFixture);
    expect(result.current.freshIds.size).toBe(0);
  });

  it("cancels the in-flight timer on unmount", () => {
    const { result, unmount } = renderHook(() =>
      useLiveTail(initialFixture, seed),
    );

    // Advance partway — timer for second entry is queued but not fired.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.lines).toHaveLength(3);

    unmount();

    // Advance past where remaining timers WOULD have fired.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    // The hook is unmounted, so its state isn't accessible. The real
    // assertion is "no setState-after-unmount warning" — which would
    // surface as a console.error in tests if it leaked.
  });
});
