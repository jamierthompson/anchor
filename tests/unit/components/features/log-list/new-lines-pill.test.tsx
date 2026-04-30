import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NewLinesPill } from "@/components/features/log-list/new-lines-pill";

describe("NewLinesPill", () => {
  it("renders nothing when count is 0", () => {
    const { container } = render(
      <NewLinesPill count={0} onClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when count is negative (defensive)", () => {
    const { container } = render(
      <NewLinesPill count={-1} onClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders 'N new lines' label when count > 1", () => {
    render(<NewLinesPill count={12} onClick={() => {}} />);
    expect(screen.getByText("12 new lines")).toBeInTheDocument();
  });

  it("uses singular 'line' label when count is 1", () => {
    render(<NewLinesPill count={1} onClick={() => {}} />);
    expect(screen.getByText("1 new line")).toBeInTheDocument();
  });

  it("aria-label scales count and pluralization (1 vs 2)", () => {
    const { rerender } = render(
      <NewLinesPill count={1} onClick={() => {}} />,
    );
    expect(
      screen.getByRole("button", { name: /Scroll to 1 new line$/ }),
    ).toBeInTheDocument();

    rerender(<NewLinesPill count={5} onClick={() => {}} />);
    expect(
      screen.getByRole("button", { name: /Scroll to 5 new lines/ }),
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<NewLinesPill count={3} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
