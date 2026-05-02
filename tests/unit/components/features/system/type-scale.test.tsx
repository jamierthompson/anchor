import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TypeScale } from "@/components/features/system/type-scale";

describe("TypeScale", () => {
  it("renders Sizes, Weights, and Line heights subsections", () => {
    render(<TypeScale />);
    expect(screen.getByRole("heading", { name: "Sizes" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Weights" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Line heights" }),
    ).toBeInTheDocument();
  });

  it("renders one row per font-size token", () => {
    render(<TypeScale />);
    expect(screen.getByText("--font-size-1")).toBeInTheDocument();
    expect(screen.getByText("--font-size-2")).toBeInTheDocument();
    expect(screen.getByText("--font-size-3")).toBeInTheDocument();
    expect(screen.getByText("--font-size-4")).toBeInTheDocument();
    expect(screen.getByText("--font-size-5")).toBeInTheDocument();
    expect(screen.getByText("--font-size-page-h1")).toBeInTheDocument();
  });

  it("renders one row per weight token", () => {
    render(<TypeScale />);
    expect(screen.getByText("--font-weight-regular")).toBeInTheDocument();
    expect(screen.getByText("--font-weight-medium")).toBeInTheDocument();
    expect(screen.queryByText("--font-weight-semibold")).toBeNull();
  });

  it("renders one row per line-height token", () => {
    render(<TypeScale />);
    expect(screen.getByText("--line-height-tight")).toBeInTheDocument();
    expect(screen.getByText("--line-height-base")).toBeInTheDocument();
  });

  it("applies the size token to its sample cell via inline style", () => {
    render(<TypeScale />);
    const tokenLabel = screen.getByText("--font-size-4");
    const row = tokenLabel.closest("tr");
    expect(row).not.toBeNull();
    if (row) {
      // The sample cell is the last <td> in the row
      const sampleCell = within(row).getAllByRole("cell").at(-1);
      expect(sampleCell).toHaveStyle({ fontSize: "var(--font-size-4)" });
    }
  });
});
