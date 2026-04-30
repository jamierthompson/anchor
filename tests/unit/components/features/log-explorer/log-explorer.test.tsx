import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LogExplorer } from "@/components/features/log-explorer/log-explorer";
import type { LogLine } from "@/types/log";

/**
 * Integration coverage for the View Context toggle.
 *
 * The unit tests on `deriveLines` already pin the rule itself; these
 * tests exercise the wiring — filter + click + derive + render — to
 * make sure the spec's modifier shortcut, gating rules, and auto-
 * collapse behavior actually surface as the expected DOM state.
 *
 * Filtering is applied here through the scenario chip bar (the prototype
 * doesn't ship per-line click-to-filter or a dropdown filter builder).
 * Tests drive scenarios via the chip labels rather than hand-crafting
 * filter state, so they exercise the same path the user does.
 *
 * The fixture is intentionally tiny (5 lines) so every assertion can
 * name a specific line by its message text without ambiguity. Range is
 * DEFAULT_CONTEXT_RANGE (±20) and the fixture is much smaller, so any
 * open context's window covers every line — what we assert is which
 * lines end up matched vs context-revealed.
 */

const T = (offset: number) => Date.UTC(2026, 3, 27, 14, 0, offset);

const fixture: LogLine[] = [
  { id: "l0", timestamp: T(0), instance: "i1", level: "INFO", message: "row zero info" },
  { id: "l1", timestamp: T(1), instance: "i1", level: "ERROR", message: "row one error" },
  { id: "l2", timestamp: T(2), instance: "i1", level: "WARN", message: "row two warn" },
  { id: "l3", timestamp: T(3), instance: "i2", level: "ERROR", message: "row three error" },
  { id: "l4", timestamp: T(4), instance: "i2", level: "INFO", message: "row four info" },
];

/**
 * Wider fixture used by tests that need a context window to fall short
 * of covering everything (so visibility differs at ±20 vs ±50 vs ±100).
 * Hoisted to module scope so multiple describe blocks can share it.
 */
const wideFixture: LogLine[] = Array.from({ length: 51 }, (_, i) => {
  const id = `l${String(i).padStart(2, "0")}`;
  if (i === 25) {
    return {
      id,
      timestamp: T(i),
      instance: "i1",
      level: "ERROR",
      message: `row ${id} error anchor`,
    };
  }
  return {
    id,
    timestamp: T(i),
    instance: "i1",
    level: "INFO",
    message: `row ${id} info`,
  };
});

const liFor = (textFragment: string | RegExp): HTMLElement => {
  const el = screen.getByText(textFragment).closest("li");
  if (!el) throw new Error(`no <li> ancestor for "${String(textFragment)}"`);
  return el as HTMLElement;
};

/**
 * The scenario chip bar's "Errors only" preset filters to levels=[ERROR].
 * Both fixtures here are entirely on instance i1/i2 with mixed levels,
 * so this preset is the only one that produces the same level-only
 * filter the old click-to-filter path used.
 */
const applyErrorFilter = () => {
  fireEvent.click(screen.getByRole("button", { name: /Errors only/ }));
};

describe("LogExplorer — View Context toggle", () => {
  it("cmd + click on a matched line opens a context: selected line is accent-marked, surrounding non-matches reveal dimmed", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    // After filter: l0, l2, l4 are hidden; l1 and l3 are visible.
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("false");

    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });

    // Selected line carries the accent marker.
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");

    // Non-matching lines in window are now visible-but-dimmed.
    const l0 = liFor(/row zero info/);
    expect(l0.getAttribute("data-visible")).toBe("true");
    expect(l0.getAttribute("data-dimmed")).toBe("true");

    const l2 = liFor(/row two warn/);
    expect(l2.getAttribute("data-visible")).toBe("true");
    expect(l2.getAttribute("data-dimmed")).toBe("true");

    // Other matched lines (l3 also ERROR) stay visible undimmed.
    const l3 = liFor(/row three error/);
    expect(l3.getAttribute("data-visible")).toBe("true");
    expect(l3.getAttribute("data-dimmed")).toBe("false");
  });

  it("cmd + click on the same line again closes the context", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    const body = liFor(/row one error/).querySelector("[data-level]")!;
    fireEvent.click(body, { metaKey: true });
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");

    fireEvent.click(body, { metaKey: true });
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");
    // Dimmed reveals collapse back to hidden.
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("false");
  });

  it("cmd + click on a different matched line opens an additional context — both stay selected", () => {
    // Multi-context support (§14 task #6 / spec §4). Two simultaneous
    // contexts means both anchor lines render the selected accent;
    // earlier selections are no longer replaced by later ones.
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });
    fireEvent.click(liFor(/row three error/).querySelector("[data-level]")!, {
      metaKey: true,
    });

    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
    expect(liFor(/row three error/).getAttribute("data-selected")).toBe("true");
  });

  it("closing one of two open contexts leaves the other selected", () => {
    // Closing the most-recently-opened context should NOT clear the
    // earlier one — each entry tracks independently.
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    const oneBody = liFor(/row one error/).querySelector("[data-level]")!;
    const threeBody = liFor(/row three error/).querySelector("[data-level]")!;

    fireEvent.click(oneBody, { metaKey: true });
    fireEvent.click(threeBody, { metaKey: true });
    fireEvent.click(threeBody, { metaKey: true }); // close l3

    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
    expect(liFor(/row three error/).getAttribute("data-selected")).toBe("false");
  });

  it("closing both contexts clears all accents", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    const oneBody = liFor(/row one error/).querySelector("[data-level]")!;
    const threeBody = liFor(/row three error/).querySelector("[data-level]")!;

    fireEvent.click(oneBody, { metaKey: true });
    fireEvent.click(threeBody, { metaKey: true });
    fireEvent.click(oneBody, { metaKey: true });
    fireEvent.click(threeBody, { metaKey: true });

    expect(document.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("cmd + click is a no-op when no filter is active (spec §3 gate)", () => {
    render(<LogExplorer lines={fixture} />);

    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });

    // No line should be selected.
    expect(document.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("cmd + click on a context-revealed (dimmed) line is a no-op (no nested context)", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    // Open a context on l1 — l0 becomes dimmed (revealed by context).
    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });
    expect(liFor(/row zero info/).getAttribute("data-dimmed")).toBe("true");

    // cmd + click on the dimmed l0 must not steal the selection.
    fireEvent.click(liFor(/row zero info/).querySelector("[data-level]")!, {
      metaKey: true,
    });
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
    expect(liFor(/row zero info/).getAttribute("data-selected")).toBe("false");
  });

  it("plain click on a line body focuses that line (and does NOT open a context)", () => {
    // Plain click is the mouse focus model from spec §7/§8: clicking a
    // line body sets keyboard focus on that line. cmd/ctrl + click stays
    // reserved for the context-toggle modifier (covered separately).
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/));

    expect(liFor(/row one error/).getAttribute("data-focused")).toBe("true");
    // Selection accent must NOT have moved — focus and selection are
    // independent states.
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");
  });

  it("auto-collapses the context when the filter clears so the selected line no longer matches (spec §5)", () => {
    // Filter changes are atomic at the chip level — clearing the active
    // chip wipes the level filter, so the previously-selected ERROR line
    // no longer matches and its surrounding context reveals collapse.
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    // Open a context on l1 (an ERROR line).
    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("true");

    // Click the active chip again to clear the filter — l1 still
    // technically matches (no filter == every line matches), but the §3
    // gate (filter active) is now false, so the accent suppresses and
    // surrounding dimmed reveals collapse since no filter is active.
    fireEvent.click(screen.getByRole("button", { name: /Errors only/ }));

    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");
  });

  it("hides the accent when all filters are removed, restores it when a matching filter is re-added", () => {
    // Spec §3 gates the View Context affordance on at least one filter
    // being active. With no filter active the accent shouldn't render,
    // but the saved selection stays in state so re-applying any filter
    // that the line matches brings the selection back in place.
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");

    // Toggle the chip off — filter state is now empty.
    fireEvent.click(screen.getByRole("button", { name: /Errors only/ }));

    // Accent suppressed — gate fails because no filter is active.
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");

    // Re-apply ERRORS — saved selection re-emerges.
    applyErrorFilter();
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
  });
});

describe("LogExplorer — keyboard focus model (spec §7)", () => {
  /**
   * Helper: get the <ul> listbox for keyboard event dispatch. Each
   * test focuses this element before sending keypresses so the
   * onKeyDown handler actually receives them — it's attached to the
   * listbox, not the document.
   */
  const listbox = () => screen.getByRole("listbox", { name: /log lines/i });

  it("Tab from the page lands on the listbox and reports no active line yet", () => {
    render(<LogExplorer lines={fixture} />);
    const list = listbox();
    list.focus();
    expect(list).toHaveFocus();
    expect(list.getAttribute("aria-activedescendant")).toBeFalsy();
  });

  it("ArrowDown from no-focus lands on the first visible line", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    listbox().focus();

    await user.keyboard("{ArrowDown}");

    expect(liFor(/row zero info/).getAttribute("data-focused")).toBe("true");
    expect(listbox().getAttribute("aria-activedescendant")).toBe("line_l0");
  });

  it("j is equivalent to ArrowDown — vim-style power-user binding", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    listbox().focus();

    await user.keyboard("j");
    expect(liFor(/row zero info/).getAttribute("data-focused")).toBe("true");
    await user.keyboard("j");
    expect(liFor(/row one error/).getAttribute("data-focused")).toBe("true");
  });

  it("ArrowUp from no-focus lands on the last visible line", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    listbox().focus();

    await user.keyboard("{ArrowUp}");

    expect(liFor(/row four info/).getAttribute("data-focused")).toBe("true");
  });

  it("k is equivalent to ArrowUp", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    listbox().focus();

    await user.keyboard("k");
    expect(liFor(/row four info/).getAttribute("data-focused")).toBe("true");
    await user.keyboard("k");
    expect(liFor(/row three error/).getAttribute("data-focused")).toBe("true");
  });

  it("clamps at the top — ArrowUp on the first line stays put", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    listbox().focus();
    await user.keyboard("{ArrowDown}{ArrowUp}{ArrowUp}");

    expect(liFor(/row zero info/).getAttribute("data-focused")).toBe("true");
  });

  it("clamps at the bottom — ArrowDown on the last line stays put", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    listbox().focus();
    await user.keyboard("{ArrowUp}{ArrowDown}{ArrowDown}");

    expect(liFor(/row four info/).getAttribute("data-focused")).toBe("true");
  });

  it("skips hidden (filtered-out) lines when navigating", async () => {
    // After ERROR filter, only l1 and l3 are visible. j should hop
    // straight from l1 to l3, not pause on the hidden l2 in between.
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    listbox().focus();

    await user.keyboard("j"); // → l1 (first visible)
    expect(liFor(/row one error/).getAttribute("data-focused")).toBe("true");

    await user.keyboard("j"); // → l3 (next visible)
    expect(liFor(/row three error/).getAttribute("data-focused")).toBe("true");
  });

  it("hops to the nearest visible line when a filter change hides the focused one (spec §7)", () => {
    // Focus l2 (WARN), then apply an ERROR filter that hides l2. The
    // focus persistence rule should jump focus to the nearest visible
    // line — l3 (next-below) wins over l1 (above) because the rule
    // prefers reading direction.
    render(<LogExplorer lines={fixture} />);
    fireEvent.click(liFor(/row two warn/));
    expect(liFor(/row two warn/).getAttribute("data-focused")).toBe("true");

    applyErrorFilter();

    expect(liFor(/row three error/).getAttribute("data-focused")).toBe("true");
  });

  it("ignores cmd/ctrl + j so the browser shortcut is preserved", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    listbox().focus();

    await user.keyboard("{Meta>}j{/Meta}");

    // No focus moved — the handler bailed on the modifier.
    expect(listbox().getAttribute("aria-activedescendant")).toBeFalsy();
  });

  it("g jumps to the first visible line", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    listbox().focus();
    // Move down a few lines first to prove g doesn't just hold us at start.
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(liFor(/row two warn/).getAttribute("data-focused")).toBe("true");

    await user.keyboard("g");

    expect(liFor(/row zero info/).getAttribute("data-focused")).toBe("true");
  });

  it("G (shift+g) jumps to the last visible line", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    listbox().focus();

    await user.keyboard("{Shift>}g{/Shift}");

    expect(liFor(/row four info/).getAttribute("data-focused")).toBe("true");
  });

  it("g/G respect the visible set (filtered lines are skipped)", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    listbox().focus();

    await user.keyboard("g");
    expect(liFor(/row one error/).getAttribute("data-focused")).toBe("true");

    await user.keyboard("{Shift>}g{/Shift}");
    expect(liFor(/row three error/).getAttribute("data-focused")).toBe("true");
  });
});

describe("LogExplorer — e toggles context on the focused line", () => {
  const listbox = () => screen.getByRole("listbox", { name: /log lines/i });

  it("opens a context on the focused line when a filter is active", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    listbox().focus();

    // Focus l1 (row one error) and press e to open a context.
    await user.keyboard("g"); // → first visible (l1)
    await user.keyboard("e");

    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
    // Surrounding non-matching lines reveal dimmed via the context window.
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("true");
    expect(liFor(/row zero info/).getAttribute("data-dimmed")).toBe("true");
  });

  it("a second e on the same focused line closes the context", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    listbox().focus();

    await user.keyboard("g"); // focus l1
    await user.keyboard("e"); // open
    await user.keyboard("e"); // close

    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");
    // Dimmed reveals collapse back to hidden.
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("false");
  });

  it("e on a different focused line stacks an additional context (multi-context model)", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    listbox().focus();

    // Open a context on l1.
    await user.keyboard("g");
    await user.keyboard("e");

    // After the context opens, the previously-hidden lines (l0, l2, l4)
    // are revealed dimmed within the window. j navigates by visibility,
    // so it walks l1 → l2 → l3. Two presses to reach l3 (also a §3-
    // matched ERROR line, so e on it is allowed).
    await user.keyboard("j");
    await user.keyboard("j");
    await user.keyboard("e");

    // Both contexts active simultaneously per the §4 multi-context rule.
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
    expect(liFor(/row three error/).getAttribute("data-selected")).toBe("true");
  });

  it("is a no-op when no line is focused — but preventDefault still fires", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    listbox().focus();

    // No focus set yet; e should bail silently without selecting anything.
    await user.keyboard("e");

    expect(document.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("is a no-op when no filter is active — spec §3 gate", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    listbox().focus();

    await user.keyboard("g"); // focus l0
    await user.keyboard("e"); // gate fails — no filter active

    expect(liFor(/row zero info/).getAttribute("data-selected")).toBe("false");
  });

  it("is a no-op on a dimmed (context-revealed only) line — spec §3 gate", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    listbox().focus();

    // Open a context on l1 — now l0 is visible-but-dimmed via the window.
    await user.keyboard("g");
    await user.keyboard("e");
    expect(liFor(/row zero info/).getAttribute("data-dimmed")).toBe("true");

    // Click l0 to focus it.
    fireEvent.click(liFor(/row zero info/));
    await user.keyboard("e");

    // The dimmed line did not become a new context anchor — the §3 gate
    // refuses it (a dimmed line is "context-only," not filter-matched).
    expect(liFor(/row zero info/).getAttribute("data-selected")).toBe("false");
    // And the original context on l1 remains untouched.
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
  });
});

describe("LogExplorer — shift+e expands the most-recent context by a fixed step", () => {
  // Uses the module-level wideFixture (51 lines, anchor at index 25).
  // Anchor-to-edge max distance is 25, so:
  //   - ±20 covers indices 5..45 → 41 visible lines
  //   - ±25 (single step beyond ±20, clamped to the boundary) covers
  //     all 51 lines
  // The 5-line `fixture` would be entirely covered by ±20, so it
  // can't differentiate step sizes — wideFixture is necessary.
  const listbox = () => screen.getByRole("listbox", { name: /log lines/i });

  /** Helper: count visible <li>s in the rendered list. */
  const visibleLineCount = () =>
    document.querySelectorAll('li[data-visible="true"]').length;

  it("grows the most-recent context's window by CONTEXT_RANGE_STEP (clamped to file boundary)", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    // Open context at default ±20 — covers indices 5..45 (41 lines).
    fireEvent.click(liFor(/row l25 error anchor/));
    await user.keyboard("e");
    expect(visibleLineCount()).toBe(41);

    // shift+e: +20 step would be ±40, but the anchor's farther edge is
    // 25 lines away, so it clamps there. ±25 covers everything.
    await user.keyboard("{Shift>}e{/Shift}");
    expect(visibleLineCount()).toBe(51);
  });

  it("targets the most-recent context, not the focused line", async () => {
    // Behaviour change vs the old cycle: shift+e used to operate on
    // whichever line was focused, which silently no-op'd or hit the
    // wrong window when focus had moved away from the anchor. Now it
    // always grows "the thing I just opened."
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    // Open context on l25 at ±20.
    fireEvent.click(liFor(/row l25 error anchor/));
    await user.keyboard("e");
    expect(visibleLineCount()).toBe(41);

    // Move focus away to a non-anchor line. Use ArrowDown so we don't
    // depend on which line is closest to l25 in the visible set.
    await user.keyboard("{ArrowDown}");

    // shift+e should still grow l25's window despite focus being
    // elsewhere — the most-recent context wins.
    await user.keyboard("{Shift>}e{/Shift}");
    expect(visibleLineCount()).toBe(51);
  });

  it("is a no-op at the file boundary (window already covers all lines from the anchor)", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    fireEvent.click(liFor(/row l25 error anchor/));
    await user.keyboard("e"); // ±20
    await user.keyboard("{Shift>}e{/Shift}"); // ±25 (clamped, covers all)
    expect(visibleLineCount()).toBe(51);

    // Subsequent presses can't grow further. Visible count stays put.
    await user.keyboard("{Shift>}e{/Shift}");
    await user.keyboard("{Shift>}e{/Shift}");
    expect(visibleLineCount()).toBe(51);
  });

  it("is a no-op when no contexts are open", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    // Focus a line but don't press `e` — no context is open. shift+e
    // must not implicitly open a context.
    fireEvent.click(liFor(/row l25 error anchor/));
    await user.keyboard("{Shift>}e{/Shift}");

    expect(liFor(/row l25 error anchor/).getAttribute("data-selected")).toBe(
      "false",
    );
    expect(visibleLineCount()).toBe(1); // just the anchor itself
  });
});

describe("LogExplorer — c copies the focused line", () => {
  const listbox = () => screen.getByRole("listbox", { name: /log lines/i });

  it("writes the formatted line text to navigator.clipboard", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<LogExplorer lines={fixture} />);
    const list = listbox();
    list.focus();

    // Land on l1 (row one error) by clicking it, then copy via `c`.
    fireEvent.click(liFor(/row one error/));
    fireEvent.keyDown(list, { key: "c" });

    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain("[i1]");
    expect(text).toContain("ERROR");
    expect(text).toContain("row one error");
  });

  it("is a no-op when no line is focused", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<LogExplorer lines={fixture} />);
    const list = listbox();
    list.focus();

    fireEvent.keyDown(list, { key: "c" });

    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("LogExplorer — global shortcuts (Esc and ?)", () => {
  it("Esc clears all open contexts (spec §7 precedence)", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    const list = screen.getByRole("listbox", { name: /log lines/i });
    list.focus();

    // Open two contexts so we can prove Esc clears ALL of them.
    await user.keyboard("g");
    await user.keyboard("e");
    await user.keyboard("j");
    await user.keyboard("j");
    await user.keyboard("e");
    expect(document.querySelectorAll('li[data-selected="true"]').length).toBe(2);

    await user.keyboard("{Escape}");

    expect(document.querySelector('li[data-selected="true"]')).toBeNull();
  });

  it("Esc with no open contexts is a no-op", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    screen.getByRole("listbox", { name: /log lines/i }).focus();

    await user.keyboard("{Escape}");

    expect(document.querySelector('li[data-selected="true"]')).toBeNull();
  });

  it("Esc preserves the filter — only contexts clear", async () => {
    // Spec §7: "Filters require explicit removal." Esc doesn't touch them.
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    screen.getByRole("listbox", { name: /log lines/i }).focus();

    await user.keyboard("g"); // focus l1
    await user.keyboard("e"); // open context

    await user.keyboard("{Escape}");

    // The active scenario chip is still pressed.
    expect(
      screen
        .getByRole("button", { name: /Errors only/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    // l0 is hidden again (filter excludes it; context that revealed it is gone).
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("false");
  });
});

describe("LogExplorer — line-action integration (spec §8 — hover icon row)", () => {
  it("View context button opens a context (toggle pipeline reuse)", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    const l1Row = liFor(/row one error/);
    const viewBtn = l1Row.querySelector<HTMLButtonElement>(
      'button[aria-label="View context"]',
    );
    expect(viewBtn).not.toBeNull();
    await user.click(viewBtn!);

    expect(l1Row.getAttribute("data-selected")).toBe("true");
    // Surrounding non-matching line revealed dimmed via the window.
    expect(liFor(/row zero info/).getAttribute("data-dimmed")).toBe("true");
  });

  it("Hide context button (active anchor) closes the open context", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    // Open via cmd+click for variety, then verify the row now offers Hide.
    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");

    const hideBtn = liFor(/row one error/).querySelector<HTMLButtonElement>(
      'button[aria-label="Hide context"]',
    );
    expect(hideBtn).not.toBeNull();
    expect(hideBtn?.getAttribute("data-active")).toBe("true");
    await user.click(hideBtn!);

    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");
  });

  it("action row is empty (no toggle/copy buttons) on lines that fail the §3 gate when no filter is active", () => {
    render(<LogExplorer lines={fixture} />);

    // No filter — no line should expose View context / Hide context.
    expect(
      document.querySelectorAll('button[aria-label="View context"]'),
    ).toHaveLength(0);
    expect(
      document.querySelectorAll('button[aria-label="Hide context"]'),
    ).toHaveLength(0);
  });

  it("dimmed (context-revealed) lines hide the View context button but keep Copy", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    // Open a context on l1 — l0 becomes visible-but-dimmed.
    await user.click(
      liFor(/row one error/).querySelector<HTMLButtonElement>(
        'button[aria-label="View context"]',
      )!,
    );
    expect(liFor(/row zero info/).getAttribute("data-dimmed")).toBe("true");

    // §3 gate refuses View context on dimmed lines (no nested context).
    expect(
      liFor(/row zero info/).querySelector('button[aria-label="View context"]'),
    ).toBeNull();
    // Copy is universal — it must work on any visible line, including
    // context-revealed dimmed ones, so a user can grab the surrounding
    // context text.
    expect(
      liFor(/row zero info/).querySelector('button[aria-label="Copy line"]'),
    ).not.toBeNull();
  });

  it("does not render Expand or Less context buttons in the action row (keyboard-only via shift+e)", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();

    // Open context at default ±20 via the anchor button.
    await user.click(
      liFor(/row l25 error anchor/).querySelector<HTMLButtonElement>(
        'button[aria-label="View context"]',
      )!,
    );

    // Anchor button flips to "Hide context" but no resize buttons
    // ever appear in the action row.
    const anchorRow = liFor(/row l25 error anchor/);
    expect(
      anchorRow.querySelector('button[aria-label="Hide context"]'),
    ).not.toBeNull();
    expect(
      anchorRow.querySelector('button[aria-label="Expand context"]'),
    ).toBeNull();
    expect(
      anchorRow.querySelector('button[aria-label="Less context"]'),
    ).toBeNull();
  });

  it("Copy button writes a formatted line to navigator.clipboard", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    const copyBtn = liFor(/row one error/).querySelector<HTMLButtonElement>(
      'button[aria-label="Copy line"]',
    );
    expect(copyBtn).not.toBeNull();
    fireEvent.click(copyBtn!);

    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain("[i1]");
    expect(text).toContain("ERROR");
    expect(text).toContain("row one error");

    vi.unstubAllGlobals();
  });
});

describe("LogExplorer — ? opens the shortcut sheet (spec §9.7)", () => {
  it("opens the sheet when ? is pressed from anywhere on the page", () => {
    render(<LogExplorer lines={fixture} />);
    expect(screen.queryByText("Keyboard shortcuts")).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "?" });

    expect(
      screen.getByRole("heading", { name: /Keyboard shortcuts/ }),
    ).toBeInTheDocument();
  });

  it("also accepts shift+/ as the ? form (US keyboard / cross-tool robustness)", () => {
    render(<LogExplorer lines={fixture} />);

    fireEvent.keyDown(document, { key: "/", shiftKey: true });

    expect(
      screen.getByRole("heading", { name: /Keyboard shortcuts/ }),
    ).toBeInTheDocument();
  });

  it("Esc closes the open sheet (Radix Dialog handles it natively)", () => {
    render(<LogExplorer lines={fixture} />);
    fireEvent.keyDown(document, { key: "?" });
    expect(
      screen.getByRole("heading", { name: /Keyboard shortcuts/ }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("heading", { name: /Keyboard shortcuts/ }),
    ).not.toBeInTheDocument();
  });

  it("Esc-while-sheet-open does NOT also clear contexts (cascade composes via defaultPrevented)", () => {
    // Open a context first, then open the sheet, then press Esc. The
    // sheet should close; the context should NOT also close.
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");

    fireEvent.keyDown(document, { key: "?" });
    fireEvent.keyDown(document, { key: "Escape" });

    // Sheet closed, context still open.
    expect(
      screen.queryByRole("heading", { name: /Keyboard shortcuts/ }),
    ).not.toBeInTheDocument();
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
  });

  it("clicking the floating ? button opens the sheet", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);

    await user.click(
      screen.getByRole("button", { name: /Open keyboard shortcuts/ }),
    );

    expect(
      screen.getByRole("heading", { name: /Keyboard shortcuts/ }),
    ).toBeInTheDocument();
  });

  it("? does NOT intercept when focus is inside a text input — user can type a literal '?'", () => {
    const { container } = render(
      <>
        <input data-testid="external" defaultValue="" />
        <LogExplorer lines={fixture} />
      </>,
    );
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="external"]',
    )!;
    input.focus();

    fireEvent.keyDown(input, { key: "?" });

    expect(
      screen.queryByRole("heading", { name: /Keyboard shortcuts/ }),
    ).not.toBeInTheDocument();
  });
});

describe("LogExplorer — deploy-boundary navigation ([ / ])", () => {
  /**
   * Fixture with two deploy boundaries so [ and ] have somewhere to
   * land — the spec §5 rule is that boundaries are always visible
   * regardless of filter, so they're the natural anchor for cross-
   * deploy navigation.
   */
  const boundaryFixture: LogLine[] = [
    { id: "b0", timestamp: T(0), instance: "i1", level: "INFO", message: "before first deploy" },
    {
      id: "deploy_a",
      timestamp: T(1),
      instance: "i1",
      level: "INFO",
      message: "🎉 Deploy live · srv-i1@a3f2c1",
      isDeployBoundary: true,
    },
    { id: "b1", timestamp: T(2), instance: "i1", level: "INFO", message: "between deploys A" },
    { id: "b2", timestamp: T(3), instance: "i1", level: "INFO", message: "between deploys B" },
    {
      id: "deploy_b",
      timestamp: T(4),
      instance: "i1",
      level: "INFO",
      message: "🎉 Deploy live · srv-i1@b9e1d7",
      isDeployBoundary: true,
    },
    { id: "b3", timestamp: T(5), instance: "i1", level: "INFO", message: "after second deploy" },
  ];

  const listbox = () => screen.getByRole("listbox", { name: /log lines/i });

  // [ and ] are reserved characters in user-event's keyboard
  // descriptor syntax (they delimit special key tokens). For these
  // tests we drive the handler directly via fireEvent.keyDown, which
  // bypasses the descriptor parser and lets us assert against the
  // exact `key` value our handler keys off.
  const press = (key: string) => fireEvent.keyDown(listbox(), { key });

  it("] jumps to the next deploy boundary from no-focus", () => {
    render(<LogExplorer lines={boundaryFixture} />);
    listbox().focus();

    press("]");

    expect(liFor(/srv-i1@a3f2c1/).getAttribute("data-focused")).toBe("true");
  });

  it("] advances forward through boundaries", () => {
    render(<LogExplorer lines={boundaryFixture} />);
    listbox().focus();

    press("]");
    press("]");

    expect(liFor(/srv-i1@b9e1d7/).getAttribute("data-focused")).toBe("true");
  });

  it("[ jumps to the previous deploy boundary", () => {
    render(<LogExplorer lines={boundaryFixture} />);
    listbox().focus();
    fireEvent.click(liFor(/after second deploy/));

    press("[");

    expect(liFor(/srv-i1@b9e1d7/).getAttribute("data-focused")).toBe("true");
  });

  it("[ from no-focus wraps to the last boundary so the binding always does something", () => {
    render(<LogExplorer lines={boundaryFixture} />);
    listbox().focus();

    press("[");

    expect(liFor(/srv-i1@b9e1d7/).getAttribute("data-focused")).toBe("true");
  });

  it("] past the last boundary wraps to the first — keeps the binding meaningful", () => {
    render(<LogExplorer lines={boundaryFixture} />);
    listbox().focus();
    fireEvent.click(liFor(/after second deploy/));

    press("]");

    expect(liFor(/srv-i1@a3f2c1/).getAttribute("data-focused")).toBe("true");
  });
});
