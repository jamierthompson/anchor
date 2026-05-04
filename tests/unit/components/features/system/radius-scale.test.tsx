import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RadiusScale } from "@/components/features/system/radius-scale";

describe("RadiusScale", () => {
  it("renders both radius tokens", () => {
    render(<RadiusScale />);
    expect(screen.getByText("--radius-1")).toBeInTheDocument();
    expect(screen.getByText("--radius-2")).toBeInTheDocument();
  });

  it("renders each token's pixel value", () => {
    render(<RadiusScale />);
    expect(screen.getByText("3px")).toBeInTheDocument();
    expect(screen.getByText("4px")).toBeInTheDocument();
  });

  it("applies the token to its sample tile via inline style", () => {
    render(<RadiusScale />);
    const tokenLabel = screen.getByText("--radius-2");
    const row = tokenLabel.closest("tr");
    const sample = row?.querySelector("td div");
    // jsdom expands the border-radius shorthand into per-corner
    // properties when read via toHaveStyle, which breaks the var()
    // round-trip. Reading the raw style attribute avoids that.
    expect(sample?.getAttribute("style")).toContain(
      "border-radius: var(--radius-2)",
    );
  });
});
