import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KeycapChrome } from "@/components/features/system/keycap-chrome";

describe("KeycapChrome", () => {
  it("renders both keycap demos labeled by their parent surface", () => {
    render(<KeycapChrome />);
    expect(
      screen.getByText("On --color-bg-elevated (legend)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("On --color-bg (shortcut sheet)"),
    ).toBeInTheDocument();
  });

  it("renders the shadow + gradient token names", () => {
    render(<KeycapChrome />);
    expect(screen.getByText("--shadow-keycap")).toBeInTheDocument();
    expect(screen.getByText("--gradient-keycap")).toBeInTheDocument();
  });
});
