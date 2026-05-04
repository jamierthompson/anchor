import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UnreadStrip } from "@/components/features/log-list/unread-strip";

describe("UnreadStrip", () => {
  it("renders nothing when count is 0", () => {
    const { container } = render(
      <UnreadStrip count={0} onClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when count is negative (defensive)", () => {
    const { container } = render(
      <UnreadStrip count={-1} onClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders 'N NEW LINES' label", () => {
    render(<UnreadStrip count={12} onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("12 NEW LINES");
  });

  it("uses 'NEW LINES' uniformly (no singular/plural variant)", () => {
    render(<UnreadStrip count={1} onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("1 NEW LINES");
  });

  it("aria-label includes the count and the action", () => {
    const { rerender } = render(<UnreadStrip count={1} onClick={() => {}} />);
    expect(
      screen.getByRole("button", { name: /Scroll to 1 new lines$/ }),
    ).toBeInTheDocument();

    rerender(<UnreadStrip count={5} onClick={() => {}} />);
    expect(
      screen.getByRole("button", { name: /Scroll to 5 new lines$/ }),
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<UnreadStrip count={3} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
