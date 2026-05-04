import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Chip } from "@/components/ui/chip/chip";

describe("Chip", () => {
  it("renders the label", () => {
    render(<Chip>All</Chip>);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
  });

  it("defaults to inactive (aria-pressed=false, no data-active)", () => {
    render(<Chip>All</Chip>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toHaveAttribute("data-active");
  });

  it("reflects active prop on aria-pressed and data-active", () => {
    render(<Chip active>All</Chip>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-active", "true");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>All</Chip>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards extra props to the underlying button", () => {
    render(
      <Chip aria-label="Filter to all logs" disabled>
        All
      </Chip>,
    );
    const button = screen.getByRole("button", { name: "Filter to all logs" });
    expect(button).toBeDisabled();
  });
});
