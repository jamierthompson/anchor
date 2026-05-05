import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/features/system/theme-toggle";

/*
 * The toggle reads/writes data-theme on document.documentElement so a
 * saved preference follows the user across every route. Tests set or
 * clear it directly on documentElement and reset between cases.
 */
function setHtmlTheme(theme?: "light" | "dark") {
  if (theme) {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    setHtmlTheme();
  });

  afterEach(() => {
    localStorage.clear();
    setHtmlTheme();
  });

  it("renders a single button whose label names the action it'll perform", () => {
    // Unset → treated as light → pressing should switch to dark.
    render(<ThemeToggle />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("Switch to dark theme");
  });

  it("the button advertises 'Switch to light' when data-theme=dark on <html>", () => {
    setHtmlTheme("dark");
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: /Switch to light theme/ }),
    ).toBeInTheDocument();
  });

  it("clicking from light flips to dark and persists", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("anchor-theme")).toBe("dark");
  });

  it("clicking from dark flips to light and persists", () => {
    setHtmlTheme("dark");
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("anchor-theme")).toBe("light");
  });
});
