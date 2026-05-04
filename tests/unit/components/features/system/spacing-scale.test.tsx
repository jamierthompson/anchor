import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpacingScale } from "@/components/features/system/spacing-scale";

describe("SpacingScale", () => {
  it("renders a row for each space token in the scale", () => {
    render(<SpacingScale />);
    expect(screen.getByText("--space-1")).toBeInTheDocument();
    expect(screen.getByText("--space-2")).toBeInTheDocument();
    expect(screen.getByText("--space-3")).toBeInTheDocument();
    expect(screen.getByText("--space-4")).toBeInTheDocument();
    expect(screen.getByText("--space-6")).toBeInTheDocument();
    expect(screen.getByText("--space-8")).toBeInTheDocument();
  });

  it("references the intentionally skipped tokens in the note", () => {
    render(<SpacingScale />);
    // Note text references --space-5 and --space-7 — the skipped steps
    expect(screen.getByText("--space-5")).toBeInTheDocument();
    expect(screen.getByText("--space-7")).toBeInTheDocument();
  });

  it("applies the token to its sample bar via inline style", () => {
    render(<SpacingScale />);
    const tokenLabel = screen.getByText("--space-4");
    const row = tokenLabel.closest("tr");
    expect(row).not.toBeNull();
    // The sample bar is the only <div> inside the row's cells.
    const bar = row?.querySelector("td div");
    expect(bar).toHaveStyle({ width: "var(--space-4)" });
  });
});
