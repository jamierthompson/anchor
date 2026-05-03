import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ColorSwatches } from "@/components/features/system/color-swatches";

/*
 * The component reads the active theme from the /system wrapper's
 * data-theme attribute (and falls back to prefers-color-scheme). Each
 * test renders the wrapper around <ColorSwatches /> and stubs
 * matchMedia so the OS-preference fallback is deterministic.
 */
function renderWithWrapper(initialTheme?: "light" | "dark") {
  return render(
    <div id="system-root" data-theme={initialTheme}>
      <ColorSwatches />
    </div>,
  );
}

describe("ColorSwatches", () => {
  beforeEach(() => {
    // jsdom doesn't implement matchMedia, and the swatches use it as
    // their fallback when data-theme is unset. Stub it to a fixed
    // "prefers light = false" so unset behavior is deterministic
    // (defaults to dark).
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(prefers-color-scheme: light)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    // @ts-expect-error — restoring the stub
    delete window.matchMedia;
  });

  it("renders Roles, Neutrals, and Opacity subsections", () => {
    renderWithWrapper("dark");
    expect(screen.getByRole("heading", { name: "Roles" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Neutrals" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Opacity" }),
    ).toBeInTheDocument();
  });

  it("renders the --opacity-dimmed token row with default + dimmed samples", () => {
    renderWithWrapper("dark");
    expect(screen.getByText("--opacity-dimmed")).toBeInTheDocument();
    expect(screen.getByText("0.4")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("Dimmed")).toBeInTheDocument();
  });

  it("renders one card per token (5 neutrals, 3 roles)", () => {
    renderWithWrapper("dark");
    expect(screen.getByText("--color-bg")).toBeInTheDocument();
    expect(screen.getByText("--color-bg-elevated")).toBeInTheDocument();
    expect(screen.getByText("--color-fg")).toBeInTheDocument();
    expect(screen.getByText("--color-fg-muted")).toBeInTheDocument();
    expect(screen.getByText("--color-border")).toBeInTheDocument();
    expect(screen.getByText("--color-accent")).toBeInTheDocument();
    expect(screen.getByText("--color-warn")).toBeInTheDocument();
    expect(screen.getByText("--color-error")).toBeInTheDocument();
  });

  it("shows the active theme's OKLCH value (dark)", () => {
    renderWithWrapper("dark");
    // --color-fg dark value
    expect(screen.getByText("oklch(0.946 0 0)")).toBeInTheDocument();
  });

  it("shows the active theme's OKLCH value (light)", () => {
    renderWithWrapper("light");
    // --color-fg light value
    expect(screen.getByText("oklch(0.205 0 0)")).toBeInTheDocument();
  });

  it("shows the dark contrast ratio when wrapper is dark", () => {
    renderWithWrapper("dark");
    // --color-fg dark contrast
    expect(screen.getByText("16.91:1 AAA")).toBeInTheDocument();
  });

  it("shows the light contrast ratio when wrapper is light", () => {
    renderWithWrapper("light");
    // --color-fg light contrast
    expect(screen.getByText("17.93:1 AAA")).toBeInTheDocument();
  });

  it("renders a usage description on every swatch", () => {
    renderWithWrapper("dark");
    expect(screen.getByText("Page background")).toBeInTheDocument();
    expect(screen.getByText("WARN level prefix in log lines")).toBeInTheDocument();
  });

  it("does not render a contrast string for tokens without a contrast claim", () => {
    renderWithWrapper("dark");
    // --color-bg has no contrast property — find its card and check.
    const tokenLabel = screen.getByText("--color-bg");
    const card = tokenLabel.closest("div")?.parentElement;
    expect(card).not.toBeNull();
    if (card) {
      // Page background card should NOT contain any AAA/AA text
      expect(within(card).queryByText(/AAA|AA/)).toBeNull();
    }
  });
});
