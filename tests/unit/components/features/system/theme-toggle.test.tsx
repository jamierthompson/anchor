import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/features/system/theme-toggle";

/*
 * The toggle reads/writes data-theme on document.documentElement
 * (the <html> element) so a saved preference follows the user across
 * every route. Tests set/clear it directly on documentElement and
 * reset between cases so each test starts from a known state.
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

  it("renders Light and Dark chips", () => {
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: /Switch to light theme/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Switch to dark theme/ }),
    ).toBeInTheDocument();
  });

  it("treats unset data-theme as light (the OS-preference-default state)", () => {
    render(<ThemeToggle />);
    const light = screen.getByRole("button", { name: /Switch to light theme/ });
    const dark = screen.getByRole("button", { name: /Switch to dark theme/ });
    expect(light).toHaveAttribute("aria-pressed", "true");
    expect(dark).toHaveAttribute("aria-pressed", "false");
  });

  it("marks Dark active when data-theme=dark on <html>", () => {
    setHtmlTheme("dark");
    render(<ThemeToggle />);
    const light = screen.getByRole("button", { name: /Switch to light theme/ });
    const dark = screen.getByRole("button", { name: /Switch to dark theme/ });
    expect(dark).toHaveAttribute("aria-pressed", "true");
    expect(light).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking Light sets data-theme=light on <html> and persists", () => {
    setHtmlTheme("dark");
    render(<ThemeToggle />);
    fireEvent.click(
      screen.getByRole("button", { name: /Switch to light theme/ }),
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("anchor-theme")).toBe("light");
  });

  it("clicking Dark sets data-theme=dark on <html> and persists", () => {
    render(<ThemeToggle />);
    fireEvent.click(
      screen.getByRole("button", { name: /Switch to dark theme/ }),
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("anchor-theme")).toBe("dark");
  });
});
