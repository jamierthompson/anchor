import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MotionScale } from "@/components/features/system/motion-scale";

describe("MotionScale", () => {
  it("renders the easing token", () => {
    render(<MotionScale />);
    expect(screen.getByText("--ease-standard")).toBeInTheDocument();
    expect(
      screen.getByText("cubic-bezier(0.32, 0.72, 0, 1)"),
    ).toBeInTheDocument();
  });

  it("renders one row per duration token", () => {
    render(<MotionScale />);
    expect(screen.getByText("--duration-fast")).toBeInTheDocument();
    expect(screen.getByText("--duration-base")).toBeInTheDocument();
    expect(screen.getByText("--duration-slow")).toBeInTheDocument();
  });

  it("renders three duration list items (easing lives in its own panel)", () => {
    const { container } = render(<MotionScale />);
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(3);
  });

  it("renders the Easing and Durations panel labels", () => {
    render(<MotionScale />);
    expect(screen.getByRole("heading", { name: "Easing" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Durations" }),
    ).toBeInTheDocument();
  });

  it("applies the scaled demo duration to each duration bar via inline style", () => {
    render(<MotionScale />);
    const fastRow = screen.getByText("--duration-fast").closest("li");
    expect(fastRow).not.toBeNull();
    // The bar is the only inner div with animationDuration applied.
    // 1.2s = 10× the actual --duration-fast (120ms).
    const bar = fastRow?.querySelector('div[aria-hidden="true"]');
    expect(bar).toHaveStyle({ animationDuration: "1.2s" });
  });
});
