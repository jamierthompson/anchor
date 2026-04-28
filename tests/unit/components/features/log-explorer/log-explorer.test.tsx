import { fireEvent, render, screen } from "@testing-library/react";
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

  it("cmd + click on a different matched line moves the selection", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!, {
      metaKey: true,
    });
    fireEvent.click(liFor(/row three error/).querySelector("[data-level]")!, {
      metaKey: true,
    });

    expect(liFor(/row one error/).getAttribute("data-selected")).toBe("false");
    expect(liFor(/row three error/).getAttribute("data-selected")).toBe("true");
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

  it("plain click on a line body does nothing — focus model is task #7", () => {
    render(<LogExplorer lines={fixture} />);
    applyErrorFilter();

    fireEvent.click(liFor(/row one error/).querySelector("[data-level]")!);
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
});
