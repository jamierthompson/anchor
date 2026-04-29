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
 * The fixture is intentionally tiny (5 lines) so every assertion can
 * name a specific line by its message text without ambiguity. Range
 * is DEFAULT_CONTEXT_RANGE (±20) and the fixture is much smaller, so
 * any open context's window covers every line — what we assert is
 * which lines end up matched vs context-revealed.
 */

const T = (offset: number) => Date.UTC(2026, 3, 27, 14, 0, offset);

const fixture: LogLine[] = [
  { id: "l0", timestamp: T(0), instance: "i1", level: "INFO", message: "row zero info" },
  { id: "l1", timestamp: T(1), instance: "i1", level: "ERROR", message: "row one error" },
  { id: "l2", timestamp: T(2), instance: "i1", level: "WARN", message: "row two warn" },
  { id: "l3", timestamp: T(3), instance: "i2", level: "ERROR", message: "row three error" },
  { id: "l4", timestamp: T(4), instance: "i2", level: "INFO", message: "row four info" },
];

const liFor = (textFragment: string | RegExp): HTMLElement => {
  const el = screen.getByText(textFragment).closest("li");
  if (!el) throw new Error(`no <li> ancestor for "${String(textFragment)}"`);
  return el as HTMLElement;
};

/** Click any one of the ERROR level badges to set `level: error` as the active filter. */
const applyErrorFilter = () => {
  const errorBadges = screen.getAllByRole("button", {
    name: /Filter by level ERROR/,
  });
  fireEvent.click(errorBadges[0]);
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
    const { container } = { container: document.body };
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
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

  it("cmd + click on an instance pill adds a filter without opening a context (stopPropagation)", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    // Two ERROR lines visible; pick the first instance pill button on l1.
    const pill = liFor(/row one error/).querySelector(
      'button[aria-label^="Filter by instance"]',
    );
    fireEvent.click(pill!, { metaKey: true });

    // Instance filter chip should now be in the bar.
    expect(screen.getByText("instance: i1")).toBeInTheDocument();
    // And no line was selected for context.
    expect(document.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("auto-collapses the context when a filter change excludes the selected line (spec §5)", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    // Open a context on l1 (an ERROR line).
    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("true");

    // Add a WARN filter on top of ERROR — l1 still matches, no collapse.
    const warnBadge = screen.getByRole("button", {
      name: /Filter by level WARN/,
    });
    fireEvent.click(warnBadge);
    expect(liFor(/row one error/).getAttribute("data-visible")).toBe("true");

    // Now remove the ERROR chip — only WARN remains, l1 no longer matches.
    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter: level: error" }),
    );

    // l1 itself is filter-hidden, and the surrounding context-only reveals
    // collapse back to hidden too. Only the WARN line stays visible.
    expect(liFor(/row two warn/).getAttribute("data-visible")).toBe("true");
    // l0 (INFO) was previously visible-dimmed via the context window — now
    // hidden because the context went dormant.
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("false");
    expect(liFor(/row four info/).getAttribute("data-visible")).toBe("false");
  });

  it("hides the accent when a filter change excludes the selected line, restores it when the filter loosens (spec §5)", () => {
    // The saved selection persists in state behind the scenes — only
    // the visual accent is gated on (filter active AND selected line
    // still matches). Re-adding a filter that re-includes the line
    // brings the accent (and the surrounding context window) back in
    // place without the user re-opening it.
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");

    // Switch the filter so l1 (ERROR) no longer matches.
    fireEvent.click(
      screen.getByRole("button", { name: /Filter by level WARN/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter: level: error" }),
    );

    // Accent suppressed — gate fails because l1 no longer matches.
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");

    // Re-add ERROR — l1 matches again, gate passes, accent returns.
    fireEvent.click(
      screen.getAllByRole("button", { name: /Filter by level ERROR/ })[0],
    );
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("true");
    // Surrounding context lines come back dimmed too — the window is
    // active again because the saved state was preserved.
    expect(liFor(/row zero info/).getAttribute("data-visible")).toBe("true");
    expect(liFor(/row zero info/).getAttribute("data-dimmed")).toBe("true");
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

    // Remove the only filter chip — filter state is now empty.
    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter: level: error" }),
    );

    // Accent suppressed — gate fails because no filter is active.
    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");

    // Re-apply ERROR — saved selection re-emerges.
    fireEvent.click(
      screen.getAllByRole("button", { name: /Filter by level ERROR/ })[0],
    );
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
