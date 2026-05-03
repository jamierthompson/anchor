import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ZIndexScale } from "@/components/features/system/z-index-scale";

describe("ZIndexScale", () => {
  it("renders both z-index tokens with their values", () => {
    render(<ZIndexScale />);
    // Token names appear in both the tile labels and the description list.
    expect(screen.getAllByText("--z-overlay").length).toBeGreaterThan(0);
    expect(screen.getAllByText("--z-modal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("100").length).toBeGreaterThan(0);
    expect(screen.getAllByText("101").length).toBeGreaterThan(0);
  });

  it("renders the page-content tile in the visual stack", () => {
    render(<ZIndexScale />);
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByText("auto")).toBeInTheDocument();
  });
});
