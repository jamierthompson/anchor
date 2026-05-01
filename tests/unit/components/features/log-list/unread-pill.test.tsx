import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UnreadPill } from "@/components/features/log-list/unread-pill";

describe("UnreadPill", () => {
  it("renders nothing when count is 0", () => {
    const { container } = render(
      <UnreadPill count={0} onClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when count is negative (defensive)", () => {
    const { container } = render(
      <UnreadPill count={-1} onClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders 'N New' label", () => {
    render(<UnreadPill count={12} onClick={() => {}} />);
    expect(screen.getByText("12 New")).toBeInTheDocument();
  });

  it("uses 'N New' label uniformly (no singular/plural variant)", () => {
    render(<UnreadPill count={1} onClick={() => {}} />);
    expect(screen.getByText("1 New")).toBeInTheDocument();
  });

  it("aria-label includes the count", () => {
    const { rerender } = render(<UnreadPill count={1} onClick={() => {}} />);
    expect(
      screen.getByRole("button", { name: /Scroll to 1 new$/ }),
    ).toBeInTheDocument();

    rerender(<UnreadPill count={5} onClick={() => {}} />);
    expect(
      screen.getByRole("button", { name: /Scroll to 5 new$/ }),
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<UnreadPill count={3} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
