import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

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
 * Wider fixture used by tests that exercise the shift+e boundary —
 * 51 lines, only l25 is an ERROR (the anchor). Anchor is centered:
 * `Math.max(25, 25) = 25` is the file-extent boundary distance.
 *
 *   - At ±20 (window 5..45): 41 lines visible; both file edges are
 *     still 5 lines away → expansion allowed.
 *   - shift+e grows by full STEP to ±40 — covers indices 0..50
 *     (the whole fixture, with each side past its file edge).
 *     `currentRange (40) >= maxDistance (25)` → boundary.
 *
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

describe("LogExplorer — View Context toggle (click-to-expand)", () => {
  it("clicking a matched line opens a context: selected line is accent-marked, surrounding non-matches reveal dimmed", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    // After filter: l0, l2, l4 are hidden; l1 and l3 are visible.
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("false");

    fireEvent.click(liFor(/row one error/));

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

  it("clicking the same line again closes the context", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/));
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");

    fireEvent.click(liFor(/row one error/));
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");
    // Dimmed reveals collapse back to hidden.
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("false");
  });

  it("clicking a different matched line opens an additional context — both stay selected", () => {
    // Multi-context support (§14 task #6 / spec §4). Two simultaneous
    // contexts means both anchor lines render the selected accent;
    // earlier selections are no longer replaced by later ones.
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/));
    fireEvent.click(liFor(/row three error/));

    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
    expect(liFor(/row three error/).getAttribute("data-selected")).toBe("true");
  });

  it("closing one of two open contexts leaves the other selected", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/));
    fireEvent.click(liFor(/row three error/));
    fireEvent.click(liFor(/row three error/)); // close l3

    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
    expect(liFor(/row three error/).getAttribute("data-selected")).toBe("false");
  });

  it("closing both contexts clears all accents", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/));
    fireEvent.click(liFor(/row three error/));
    fireEvent.click(liFor(/row one error/));
    fireEvent.click(liFor(/row three error/));

    expect(document.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("clicking a line is a no-op for context when no filter is active (spec §3 gate)", () => {
    render(<LogExplorer lines={fixture} />);

    fireEvent.click(liFor(/row one error/));

    // No line should be selected — gate fails with no filter active.
    expect(document.querySelector('[data-selected="true"]')).toBeNull();
    // Click still moves focus.
    expect(liFor(/row one error/).getAttribute("data-focused")).toBe("true");
  });

  it("clicking a context-revealed (dimmed) line does not open a nested context", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/));
    expect(liFor(/row zero info/).getAttribute("data-dimmed")).toBe("true");

    fireEvent.click(liFor(/row zero info/));

    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
    expect(liFor(/row zero info/).getAttribute("data-selected")).toBe("false");
  });

  it("clicking a line always moves focus, even when context toggle is gated off", () => {
    // Plain click: focus moves regardless of whether the §3 gate
    // would let context expansion happen. With no filter active the
    // gate is closed but focus still tracks the click.
    render(<LogExplorer lines={fixture} />);

    fireEvent.click(liFor(/row one error/));
    expect(liFor(/row one error/).getAttribute("data-focused")).toBe("true");
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");
  });

  it("auto-suppresses the accent when the filter clears so the selected line no longer matches (spec §5)", () => {
    // Filter changes are atomic at the chip level — clearing the active
    // chip wipes the level filter, so the previously-selected ERROR line
    // no longer satisfies the §3 gate and the accent disappears.
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/));
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("true");

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

    fireEvent.click(liFor(/row one error/));
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /Errors only/ }));
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");

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
  // Uses the module-level wideFixture (51 lines, l25 the only ERROR
  // and the anchor). Anchor is centered: file-extent boundary
  // distance is `Math.max(25, 25) = 25` on each side.
  //
  //   - At ±20 (window 5..45): 41 visible lines. Both file edges
  //     are still 5 lines away → expansion allowed.
  //   - shift+e: full +20 step → ±40. Window covers indices -15..65
  //     (clamped 0..50) — past both edges. All 51 lines visible,
  //     boundary reached.
  const listbox = () => screen.getByRole("listbox", { name: /log lines/i });

  /** Helper: count visible <li>s in the rendered list. */
  const visibleLineCount = () =>
    document.querySelectorAll('li[data-visible="true"]').length;

  it("grows the most-recent context's window by a full CONTEXT_RANGE_STEP each press", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    // Click the anchor line to open a context at default ±20 —
    // covers indices 5..45 (41 lines).
    fireEvent.click(liFor(/row l25 error anchor/));
    expect(visibleLineCount()).toBe(41);

    // shift+e: full +20 step, so ±40. Past both file edges → all 51.
    await user.keyboard("{Shift>}e{/Shift}");
    expect(visibleLineCount()).toBe(51);
  });

  it("targets the most-recent context, not the focused line", async () => {
    // Behaviour: shift+e operates on the most-recently-opened context
    // regardless of where focus is. Focus and context-anchor are
    // independent.
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    fireEvent.click(liFor(/row l25 error anchor/));
    expect(visibleLineCount()).toBe(41);

    // Move focus away to a non-anchor line.
    await user.keyboard("{ArrowDown}");

    // shift+e should still grow l25's window despite focus being
    // elsewhere — the most-recent context wins.
    await user.keyboard("{Shift>}e{/Shift}");
    expect(visibleLineCount()).toBe(51);
  });

  it("is a no-op once both file edges are covered by the window", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    fireEvent.click(liFor(/row l25 error anchor/)); // open at ±20
    await user.keyboard("{Shift>}e{/Shift}"); // ±40 — past both edges
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

    // Focus the anchor line via keyboard (avoiding click — click would
    // now open a context, defeating the test). g jumps focus to the
    // first visible line, which is l25 with the error filter.
    await user.keyboard("g");
    await user.keyboard("{Shift>}e{/Shift}");

    expect(liFor(/row l25 error anchor/).getAttribute("data-selected")).toBe(
      "false",
    );
    expect(visibleLineCount()).toBe(1); // just the anchor itself
  });
});

describe("LogExplorer — contextual legend (top-right toolbar)", () => {
  const listbox = () => screen.getByRole("listbox", { name: /log lines/i });

  /**
   * Helper: read the entry's accessible content (caps + label) from
   * the legend toolbar. Returns concatenated text so we can assert
   * "what does the entry say right now" in one expression.
   */
  const legendText = () =>
    screen.getByRole("toolbar", { name: /Keyboard hints/ }).textContent ?? "";

  it("shows the ? for-all-shortcuts entry by default (no contexts open)", () => {
    render(<LogExplorer lines={fixture} />);
    expect(legendText()).toContain("?");
    expect(legendText()).toMatch(/for all shortcuts/i);
    // And it's clickable — replaces the old FAB.
    expect(
      screen.getByRole("button", { name: /Open keyboard shortcuts/ }),
    ).toBeInTheDocument();
  });

  it("shows Shift+E + E (hide context) + Esc when a context is open with room to grow", () => {
    // Click-to-expand also focuses the anchor line, so the legend's
    // E entry resolves to "Hide context" (focused line is the anchor
    // of an open context). Shift+E (expand) and Esc (close) are
    // both applicable too — three actions are available simultaneously.
    // Order left → right: Shift+E (growth) → E (per-line) → Esc (dismiss).
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row l25 error anchor/)); // open at ±20

    expect(legendText()).toMatch(/hide context/i);
    expect(legendText()).toMatch(/expand context/i);
    expect(legendText()).toMatch(/close/i);
    // No `?` keycap while context-relevant hints are showing.
    expect(legendText()).not.toMatch(/for all shortcuts/i);
    // Visible cap order: Shift+E (expand) → E (hide) → Esc (close).
    const legendToolbar = screen.getByRole("toolbar", {
      name: /Keyboard hints/,
    });
    const capTexts = Array.from(legendToolbar.querySelectorAll("kbd")).map(
      (k) => k.textContent,
    );
    expect(capTexts).toEqual(["Shift", "E", "E", "Esc"]);
  });

  it("drops Shift+E when the most-recent context can't expand further (E hide + Esc remain)", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    fireEvent.click(liFor(/row l25 error anchor/)); // open at ±20
    await user.keyboard("{Shift>}e{/Shift}"); // ±40 — clamps at boundary

    // Shift+E goes away; the remaining actions are "hide this context"
    // (focused line is still the anchor) and "close all" via Esc.
    expect(legendText()).toMatch(/hide context/i);
    expect(legendText()).toMatch(/close/i);
    expect(legendText()).not.toMatch(/expand context/i);
    // Cap order: E (hide) → Esc (close).
    const legendToolbar = screen.getByRole("toolbar", {
      name: /Keyboard hints/,
    });
    const capTexts = Array.from(legendToolbar.querySelectorAll("kbd")).map(
      (k) => k.textContent,
    );
    expect(capTexts).toEqual(["E", "Esc"]);
  });

  it("clicking the Shift+E entry expands the context (mouse path matches keyboard binding)", async () => {
    // The legend doubles as a mouse command center — clicking the
    // Shift+E hint fires the same expand handler as pressing the
    // keyboard shortcut. Confirms there's a non-keyboard path for
    // every legend state.
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row l25 error anchor/)); // open at ±20 → 41 visible
    expect(document.querySelectorAll('li[data-visible="true"]').length).toBe(
      41,
    );

    // Click the legend's Shift+E entry instead of pressing the keys.
    await user.click(
      screen.getByRole("button", { name: /Expand context/ }),
    );

    expect(document.querySelectorAll('li[data-visible="true"]').length).toBe(
      51,
    );
  });

  it("clicking the Esc entry at the boundary clears all open contexts and the legend follows", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    // Open and expand to boundary so the legend shows the Esc entry.
    fireEvent.click(liFor(/row l25 error anchor/));
    await user.keyboard("{Shift>}e{/Shift}");

    await user.click(
      screen.getByRole("button", { name: /Close all open contexts/ }),
    );

    // All contexts cleared — same effect as pressing Esc.
    expect(document.querySelector('li[data-selected="true"]')).toBeNull();
    // Esc / Shift+E entries are gone; only the focused-line E binding
    // is still applicable (the line stays focused after closing and
    // still passes the §3 gate as a filter-matched ERROR).
    expect(legendText()).not.toMatch(/close/i);
    expect(legendText()).not.toMatch(/expand context/i);
    expect(legendText()).toMatch(/view context/i);
  });

  it("falls back to the ? entry when nothing is actionable (no filter, no focus, no contexts)", () => {
    // The legend always says *something* — when no filter is active
    // and no line is focused, the fallback is the entry to the
    // shortcut sheet. Once any state is engaged (filter, focus,
    // context) the relevant E / Esc entries take over.
    render(<LogExplorer lines={wideFixture} />);

    expect(legendText()).toMatch(/for all shortcuts/i);
  });

  it("shows Esc 'Clear filter' when a filter is active and nothing else is in play", () => {
    // Filter-active, no focus, no context: Esc has work to do (clear
    // the filter), so the legend offers it as the primary action.
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();

    expect(legendText()).toMatch(/clear filter/i);
    const legendToolbar = screen.getByRole("toolbar", {
      name: /Keyboard hints/,
    });
    const capTexts = Array.from(legendToolbar.querySelectorAll("kbd")).map(
      (k) => k.textContent,
    );
    expect(capTexts).toEqual(["Esc"]);
  });

  it("pressing Esc with a filter active and no contexts open clears the filter", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    expect(
      screen.getByRole("button", { name: /Errors only/ }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");

    await user.keyboard("{Escape}");

    expect(
      screen.getByRole("button", { name: /Errors only/ }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("false");
  });

  it("shows E (view context) + Esc (clear filter) when a filter-matched line is focused", async () => {
    // Focused + filter-active, no context: both E (view context) and
    // Esc (clear filter) are applicable, so both surface.
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    await user.keyboard("g"); // focus l25 (only visible filter-matched line)

    expect(legendText()).toMatch(/view context/i);
    expect(legendText()).toMatch(/clear filter/i);
    // Cap order: E (view) → Esc (clear filter).
    const legendToolbar = screen.getByRole("toolbar", {
      name: /Keyboard hints/,
    });
    const capTexts = Array.from(legendToolbar.querySelectorAll("kbd")).map(
      (k) => k.textContent,
    );
    expect(capTexts).toEqual(["E", "Esc"]);
  });

  it("clicking the legend's E entry opens a context on the focused line", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={wideFixture} />);
    applyErrorFilter();
    listbox().focus();

    await user.keyboard("g"); // focus l25

    await user.click(
      screen.getByRole("button", { name: /View context on focused line/ }),
    );

    expect(liFor(/row l25 error anchor/).getAttribute("data-selected")).toBe(
      "true",
    );
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

  it("Esc with no contexts and no filter is a no-op", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    screen.getByRole("listbox", { name: /log lines/i }).focus();

    await user.keyboard("{Escape}");

    // Nothing was open / active to dismiss.
    expect(document.querySelector('li[data-selected="true"]')).toBeNull();
  });

  it("Esc cascade: closes contexts first, leaving the filter intact", async () => {
    // Esc precedence: contexts before filter. Pressing Esc while a
    // context is open should dismiss the context but leave the
    // active scenario chip pressed; a second Esc would clear the
    // filter.
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    screen.getByRole("listbox", { name: /log lines/i }).focus();

    await user.keyboard("g"); // focus l1
    await user.keyboard("e"); // open context

    await user.keyboard("{Escape}");

    // The active scenario chip is still pressed — context was the
    // dismissable thing.
    expect(
      screen
        .getByRole("button", { name: /Errors only/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    // l0 hidden again — filter excludes it; the context that revealed
    // it is gone.
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("false");

    // A second Esc clears the filter.
    await user.keyboard("{Escape}");
    expect(
      screen
        .getByRole("button", { name: /Errors only/ })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
});

describe("LogExplorer — line-row affordances (gutter anchor + clickable rows)", () => {
  it("the in-row anchor button is gone — no View/Hide context buttons render anywhere", async () => {
    // The old hover-revealed anchor button moved to the left gutter
    // as a non-interactive accent indicator. Confirm no <button> with
    // those labels exists in any state.
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    expect(
      document.querySelector('button[aria-label="View context"]'),
    ).toBeNull();

    fireEvent.click(liFor(/row one error/));
    expect(
      document.querySelector('button[aria-label="Hide context"]'),
    ).toBeNull();
  });

  it("rows where the §3 gate passes are marked clickable (cursor + hover hint)", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    // l1 (error) is filter-matched and visible — clickable.
    expect(liFor(/row one error/).getAttribute("data-clickable")).toBe("true");
  });

  it("rows where the §3 gate fails are NOT marked clickable (no cursor / hover hint)", () => {
    // No filter active — no line meets the gate. Click still moves
    // focus, but the affordance shouldn't lie about being expandable.
    render(<LogExplorer lines={fixture} />);

    expect(liFor(/row one error/).getAttribute("data-clickable")).toBe("false");
  });

  it("a selected row stays clickable so the user can click again to close", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/));
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
    expect(liFor(/row one error/).getAttribute("data-clickable")).toBe("true");
  });
});

describe("LogExplorer — ? opens the shortcut sheet (spec §9.7)", () => {
  it("opens the sheet when ? is pressed from anywhere on the page", () => {
    render(<LogExplorer lines={fixture} />);
    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "?" });

    expect(
      screen.getByRole("heading", { name: /Keyboard Shortcuts/ }),
    ).toBeInTheDocument();
  });

  it("also accepts shift+/ as the ? form (US keyboard / cross-tool robustness)", () => {
    render(<LogExplorer lines={fixture} />);

    fireEvent.keyDown(document, { key: "/", shiftKey: true });

    expect(
      screen.getByRole("heading", { name: /Keyboard Shortcuts/ }),
    ).toBeInTheDocument();
  });

  it("Esc closes the open sheet (Radix Dialog handles it natively)", () => {
    render(<LogExplorer lines={fixture} />);
    fireEvent.keyDown(document, { key: "?" });
    expect(
      screen.getByRole("heading", { name: /Keyboard Shortcuts/ }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("heading", { name: /Keyboard Shortcuts/ }),
    ).not.toBeInTheDocument();
  });

  it("Esc-while-sheet-open does NOT also clear contexts (cascade composes via defaultPrevented)", () => {
    // Open a context first, then open the sheet, then press Esc. The
    // sheet should close; the context should NOT also close.
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();
    fireEvent.click(liFor(/row one error/));
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");

    fireEvent.keyDown(document, { key: "?" });
    fireEvent.keyDown(document, { key: "Escape" });

    // Sheet closed, context still open.
    expect(
      screen.queryByRole("heading", { name: /Keyboard Shortcuts/ }),
    ).not.toBeInTheDocument();
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
  });

  it("clicking the legend's ? entry opens the sheet (mouse path replaces the old FAB)", async () => {
    const user = userEvent.setup();
    render(<LogExplorer lines={fixture} />);

    await user.click(
      screen.getByRole("button", { name: /Open keyboard shortcuts/ }),
    );

    expect(
      screen.getByRole("heading", { name: /Keyboard Shortcuts/ }),
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
      screen.queryByRole("heading", { name: /Keyboard Shortcuts/ }),
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
      message: "Deploy live · srv-i1@a3f2c1",
      isDeployBoundary: true,
    },
    { id: "b1", timestamp: T(2), instance: "i1", level: "INFO", message: "between deploys A" },
    { id: "b2", timestamp: T(3), instance: "i1", level: "INFO", message: "between deploys B" },
    {
      id: "deploy_b",
      timestamp: T(4),
      instance: "i1",
      level: "INFO",
      message: "Deploy live · srv-i1@b9e1d7",
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
