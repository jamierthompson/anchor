import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogLine } from "@/components/features/log-list/log-line";
import type { LogLine as LogLineType } from "@/types/log";

const baseLine: LogLineType = {
  id: "log_0001",
  // 2026-04-27T14:32:08Z
  timestamp: Date.UTC(2026, 3, 27, 14, 32, 8),
  instance: "7tbsm",
  level: "INFO",
  message: "GET /api/users 200 in 42ms",
};

describe("LogLine — regular lines", () => {
  it("renders the timestamp as HH:MM:SS in UTC", () => {
    render(<LogLine line={baseLine} />);
    expect(screen.getByText("14:32:08")).toBeInTheDocument();
  });

  it("renders the timestamp as a <time> element with an ISO dateTime", () => {
    render(<LogLine line={baseLine} />);
    const timeEl = screen.getByText("14:32:08");
    expect(timeEl.tagName).toBe("TIME");
    expect(timeEl).toHaveAttribute("dateTime", "2026-04-27T14:32:08.000Z");
  });

  it("renders the instance id", () => {
    render(<LogLine line={baseLine} />);
    expect(screen.getByText("7tbsm")).toBeInTheDocument();
  });

  it("renders an INFO message without a level prefix", () => {
    render(<LogLine line={baseLine} />);
    expect(screen.getByText(/GET \/api\/users/)).toBeInTheDocument();
    expect(screen.queryByText("WARN")).not.toBeInTheDocument();
    expect(screen.queryByText("ERROR")).not.toBeInTheDocument();
  });

  it("prefixes WARN messages with 'WARN'", () => {
    render(
      <LogLine
        line={{ ...baseLine, level: "WARN", message: "Slow query took 1247ms" }}
      />,
    );
    expect(screen.getByText("WARN")).toBeInTheDocument();
    expect(screen.getByText(/Slow query took 1247ms/)).toBeInTheDocument();
  });

  it("prefixes ERROR messages with 'ERROR'", () => {
    render(
      <LogLine
        line={{
          ...baseLine,
          level: "ERROR",
          message: "db connection refused",
        }}
      />,
    );
    expect(screen.getByText("ERROR")).toBeInTheDocument();
    expect(screen.getByText(/db connection refused/)).toBeInTheDocument();
  });

  it("does not prefix DEBUG messages but tags the row's data-level", () => {
    const { container } = render(
      <LogLine
        line={{ ...baseLine, level: "DEBUG", message: "GC paused 14ms" }}
      />,
    );
    expect(screen.queryByText("DEBUG")).not.toBeInTheDocument();
    expect(screen.getByText(/GC paused 14ms/)).toBeInTheDocument();
    // The level lives on a data attribute so styling and future selection
    // logic can key off it without re-deriving from the message text.
    expect(container.querySelector('[data-level="DEBUG"]')).not.toBeNull();
  });

  it("renders a request id as a distinct element when present", () => {
    render(
      <LogLine line={{ ...baseLine, requestId: "a3f9c2" }} />,
    );
    expect(screen.getByText("a3f9c2")).toBeInTheDocument();
  });

  it("does not render a request id element when none is set", () => {
    const { container } = render(<LogLine line={baseLine} />);
    // The .requestId span carries the `req=` prefix as a ::before
    // pseudo-element, so absence is checked structurally rather than
    // via visible text.
    expect(container.querySelector('[class*="requestId"]')).toBeNull();
  });

  it("renders the instance, level prefix, and request-id badge as plain (non-interactive) spans", () => {
    // Filtering moved to the scenario-chips bar above the list.
    // Per-line elements are pure presentation — no click-to-filter
    // buttons, no role="button", no aria-label="Filter by …".
    render(
      <LogLine
        line={{ ...baseLine, level: "ERROR", requestId: "a3f9c2" }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Filter by/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("7tbsm").tagName).toBe("SPAN");
    expect(screen.getByText("ERROR").tagName).toBe("SPAN");
    expect(screen.getByText("a3f9c2").tagName).toBe("SPAN");
  });
});

describe("LogLine — dim styling lives on the inner element", () => {
  it("carries data-dimmed='true' on the inner line element when isDimmed is set", () => {
    // Dim opacity composes with the parent <li>'s visibility opacity.
    // The attribute on the inner element is what the CSS rule keys
    // off — moving it to the outer wrapper would let the row's
    // visibility opacity override the dimmed value.
    const { container } = render(<LogLine line={baseLine} isDimmed />);
    const inner = container.querySelector("[data-level]");
    expect(inner?.getAttribute("data-dimmed")).toBe("true");
  });

  it("data-dimmed defaults to 'false' when isDimmed is omitted", () => {
    const { container } = render(<LogLine line={baseLine} />);
    const inner = container.querySelector("[data-level]");
    expect(inner?.getAttribute("data-dimmed")).toBe("false");
  });

  it("carries data-selected on the inner line element when isSelected is set", () => {
    const { container, rerender } = render(<LogLine line={baseLine} />);
    const inner = container.querySelector("[data-level]");
    expect(inner?.getAttribute("data-selected")).toBe("false");

    rerender(<LogLine line={baseLine} isSelected />);
    expect(inner?.getAttribute("data-selected")).toBe("true");
  });

  it("deploy boundaries do not carry data-dimmed (always undimmed)", () => {
    const { container } = render(
      <LogLine
        line={{
          ...baseLine,
          isDeployBoundary: true,
          message: "Deploy live · srv-7tbsm@a3f2c1",
        }}
        isDimmed
      />,
    );
    const sep = container.querySelector('[role="separator"]');
    expect(sep?.getAttribute("data-dimmed")).toBeNull();
  });
});

describe("LogLine — deploy boundaries", () => {
  const deployLine: LogLineType = {
    ...baseLine,
    id: "log_deploy",
    isDeployBoundary: true,
    message: "Deploy live · srv-7tbsm@a3f2c1",
  };

  it("renders deploy boundaries with the separator role", () => {
    render(<LogLine line={deployLine} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("includes the deploy message text", () => {
    render(<LogLine line={deployLine} />);
    expect(
      screen.getByText("Deploy live · srv-7tbsm@a3f2c1"),
    ).toBeInTheDocument();
  });

  it("does not render the time / instance columns for deploy boundaries", () => {
    render(<LogLine line={deployLine} />);
    expect(screen.queryByText("14:32:08")).not.toBeInTheDocument();
    expect(screen.queryByText("7tbsm")).not.toBeInTheDocument();
  });
});

describe("LogLine — no in-row action buttons", () => {
  // The hover-revealed action row was retired with the move to
  // click-to-expand. The anchor button moved into the left gutter as a
  // non-interactive accent indicator (rendered by LogListItem, not
  // LogLine), and the Copy button was removed entirely. LogLine itself
  // should never render a <button> regardless of the flags it receives.
  it("renders no buttons in any state", () => {
    const { rerender } = render(<LogLine line={baseLine} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <LogLine
        line={baseLine}
        onToggleContext={() => {}}
        canToggleContext
        isSelected
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
