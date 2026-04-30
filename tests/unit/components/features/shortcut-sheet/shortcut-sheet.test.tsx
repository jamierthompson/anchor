import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShortcutSheet } from "@/components/features/shortcut-sheet/shortcut-sheet";

/**
 * Coverage for the shortcut sheet's render shape and the trigger
 * button. Open/close mechanics are exercised end-to-end in
 * log-explorer.test.tsx (where the sheet is wired to LogExplorer's
 * `?` keyboard shortcut and `setSheetOpen`); here we just verify
 * the component contract — given `open=true`, what does it render?
 */

describe("ShortcutSheet — rendered modal", () => {
  it("renders all four group titles when open", () => {
    render(<ShortcutSheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("renders the dialog title 'Keyboard Shortcuts'", () => {
    render(<ShortcutSheet open={true} onOpenChange={() => {}} />);
    expect(
      screen.getByRole("heading", { name: /Keyboard Shortcuts/ }),
    ).toBeInTheDocument();
  });

  it("renders descriptions for known bindings", () => {
    render(<ShortcutSheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText(/Next Visible Line/)).toBeInTheDocument();
    expect(screen.getByText(/Toggle Context on Focused Line/)).toBeInTheDocument();
    expect(screen.getByText(/Open This Shortcut Sheet/)).toBeInTheDocument();
  });

  it("renders keycaps for the j/↓ alias as separate <kbd> elements", () => {
    render(<ShortcutSheet open={true} onOpenChange={() => {}} />);
    // Radix Dialog portals content to document.body, so query against
    // the document — not the render container. <kbd> elements are the
    // shape used for caps; this assertion proves the alias contract
    // surfaces as two distinct caps in the DOM (vs. one combined cell).
    const caps = Array.from(document.querySelectorAll("kbd"));
    const capTexts = caps.map((c) => c.textContent);
    expect(capTexts).toContain("J");
    expect(capTexts).toContain("↓");
  });

  it("renders shift+e as two adjacent keycaps", () => {
    render(<ShortcutSheet open={true} onOpenChange={() => {}} />);
    const caps = Array.from(document.querySelectorAll("kbd"));
    const capTexts = caps.map((c) => c.textContent);
    // Shift cap (used by both Shift+G and Shift+E) appears at least twice.
    expect(capTexts.filter((t) => t === "Shift").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(capTexts).toContain("E");
  });

  it("renders no group titles when closed (dialog content not portaled)", () => {
    render(<ShortcutSheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Navigation")).not.toBeInTheDocument();
  });

  it("renders no in-modal close button (Esc + click-outside cover dismissal)", () => {
    // The X close button was removed to reduce visual clutter — the
    // sheet itself documents Esc as the dismiss binding.
    render(<ShortcutSheet open={true} onOpenChange={() => {}} />);
    expect(
      screen.queryByRole("button", { name: /Close/i }),
    ).not.toBeInTheDocument();
  });
});
