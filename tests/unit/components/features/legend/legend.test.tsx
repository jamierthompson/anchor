import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Legend } from "@/components/features/legend/legend";

/**
 * Component-contract coverage for the Legend. State-driven swapping
 * (which item appears for a given app state) is exercised in
 * log-explorer.test.tsx, where the legend is wired to the open-
 * contexts state.
 */

describe("Legend — render shape", () => {
  it("renders nothing when items is empty", () => {
    const { container } = render(<Legend items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each cap as a <kbd> element", () => {
    render(
      <Legend
        items={[{ keys: ["Shift", "E"], label: "Expand context" }]}
      />,
    );
    const caps = Array.from(document.querySelectorAll("kbd"));
    expect(caps.map((c) => c.textContent)).toEqual(["Shift", "E"]);
  });

  it("renders the label text alongside the caps", () => {
    render(
      <Legend
        items={[{ keys: ["Shift", "E"], label: "Expand context" }]}
      />,
    );
    expect(screen.getByText("Expand context")).toBeInTheDocument();
  });

  it("renders as <button> when onClick is provided", () => {
    const onClick = vi.fn();
    render(
      <Legend
        items={[
          {
            keys: ["?"],
            label: "for all shortcuts",
            ariaLabel: "Open keyboard shortcuts",
            onClick,
          },
        ]}
      />,
    );
    const button = screen.getByRole("button", {
      name: /Open keyboard shortcuts/,
    });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not render a button when onClick is absent (purely visual hint)", () => {
    render(
      <Legend
        items={[{ keys: ["Shift", "E"], label: "Expand context" }]}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders label-only entries with no keycaps when keys are omitted", () => {
    // Used for boundary states like "no more context to expand": the
    // binding still exists, but showing keys would imply pressing them
    // would do something, which it wouldn't.
    render(<Legend items={[{ label: "No more context to expand" }]} />);
    expect(screen.getByText("No more context to expand")).toBeInTheDocument();
    expect(document.querySelectorAll("kbd")).toHaveLength(0);
  });

  it("renders as a toolbar with an accessible name", () => {
    render(
      <Legend items={[{ keys: ["?"], label: "for all shortcuts" }]} />,
    );
    expect(
      screen.getByRole("toolbar", { name: /Keyboard hints/ }),
    ).toBeInTheDocument();
  });
});
