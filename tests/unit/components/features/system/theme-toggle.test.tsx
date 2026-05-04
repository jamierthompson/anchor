import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/features/system/theme-toggle";

/*
 * The toggle reads/writes data-theme on a wrapper element with
 * id="system-root", which the route layout would normally render.
 * Each test renders that wrapper around <ThemeToggle /> so the
 * component finds its target.
 */
function renderWithWrapper(initialTheme?: "light" | "dark") {
  return render(
    <div id="system-root" data-theme={initialTheme}>
      <ThemeToggle />
    </div>,
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders Light and Dark chips", () => {
    renderWithWrapper();
    expect(
      screen.getByRole("button", { name: /Switch to light theme/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Switch to dark theme/ }),
    ).toBeInTheDocument();
  });

  it("treats unset data-theme as light (the OS-preference-default state)", () => {
    renderWithWrapper();
    const light = screen.getByRole("button", { name: /Switch to light theme/ });
    const dark = screen.getByRole("button", { name: /Switch to dark theme/ });
    expect(light).toHaveAttribute("aria-pressed", "true");
    expect(dark).toHaveAttribute("aria-pressed", "false");
  });

  it("marks Dark active when data-theme=dark on the wrapper", () => {
    renderWithWrapper("dark");
    const light = screen.getByRole("button", { name: /Switch to light theme/ });
    const dark = screen.getByRole("button", { name: /Switch to dark theme/ });
    expect(dark).toHaveAttribute("aria-pressed", "true");
    expect(light).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking Light sets data-theme=light on the wrapper and persists", () => {
    renderWithWrapper("dark");
    fireEvent.click(
      screen.getByRole("button", { name: /Switch to light theme/ }),
    );
    expect(document.getElementById("system-root")).toHaveAttribute(
      "data-theme",
      "light",
    );
    expect(localStorage.getItem("anchor-theme")).toBe("light");
  });

  it("clicking Dark sets data-theme=dark on the wrapper and persists", () => {
    renderWithWrapper();
    fireEvent.click(
      screen.getByRole("button", { name: /Switch to dark theme/ }),
    );
    expect(document.getElementById("system-root")).toHaveAttribute(
      "data-theme",
      "dark",
    );
    expect(localStorage.getItem("anchor-theme")).toBe("dark");
  });
});
