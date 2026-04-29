import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
      <LogLine line={{ ...baseLine, requestId: "req_a3f9c2" }} />,
    );
    expect(screen.getByText("req_a3f9c2")).toBeInTheDocument();
  });

  it("does not render a request id element when none is set", () => {
    render(<LogLine line={baseLine} />);
    expect(screen.queryByText(/^req_/)).not.toBeInTheDocument();
  });
});

describe("LogLine — dim styling lives on the inner element", () => {
  it("carries data-dimmed='true' on the inner line element when isDimmed is set", () => {
    // Dim opacity composes with Motion's visibility opacity on the
    // parent <li>. The attribute on the inner element is what the CSS
    // rule keys off — moving it to the outer wrapper would let Motion's
    // inline opacity override the dimmed value.
    const { container } = render(<LogLine line={baseLine} isDimmed />);
    const inner = container.querySelector("[data-level]");
    expect(inner?.getAttribute("data-dimmed")).toBe("true");
  });

  it("data-dimmed defaults to 'false' when isDimmed is omitted", () => {
    const { container } = render(<LogLine line={baseLine} />);
    const inner = container.querySelector("[data-level]");
    expect(inner?.getAttribute("data-dimmed")).toBe("false");
  });

  it("carries data-selected on the inner line element so the anchor icon can fade in via CSS", () => {
    // The anchor-icon visibility is driven by a CSS rule
    // (.line[data-selected="true"] .anchorIcon { opacity: 1 }) so the
    // attribute has to live on the inner .line, not just the outer <li>.
    const { container, rerender } = render(<LogLine line={baseLine} />);
    const inner = container.querySelector("[data-level]");
    expect(inner?.getAttribute("data-selected")).toBe("false");

    rerender(<LogLine line={baseLine} isSelected />);
    expect(inner?.getAttribute("data-selected")).toBe("true");
  });

  it("renders the Anchor icon inside the line for the CSS opacity transition to target", () => {
    // The icon is always in the DOM — its visibility comes from the
    // opacity transition keyed off data-selected. Lucide icons render
    // an <svg> with a `lucide-anchor` class on it, which is a stable
    // hook for this assertion.
    const { container } = render(<LogLine line={baseLine} isSelected />);
    expect(container.querySelector("svg.lucide-anchor")).not.toBeNull();
  });

  it("deploy boundaries do not carry data-dimmed (always undimmed per spec §5)", () => {
    const { container } = render(
      <LogLine
        line={{
          ...baseLine,
          isDeployBoundary: true,
          message: "🎉 Deploy live · srv-7tbsm@a3f2c1",
        }}
        isDimmed
      />,
    );
    const sep = container.querySelector('[role="separator"]');
    expect(sep?.getAttribute("data-dimmed")).toBeNull();
  });
});

describe("LogLine — click-to-filter", () => {
  it("renders the instance pill as a button when onFilterToggle is supplied", () => {
    render(<LogLine line={baseLine} onFilterToggle={() => {}} />);
    expect(
      screen.getByRole("button", { name: /Filter by instance 7tbsm/ }),
    ).toBeInTheDocument();
  });

  it("renders the instance as a plain span when no callback is supplied", () => {
    render(<LogLine line={baseLine} />);
    expect(
      screen.queryByRole("button", { name: /Filter by instance/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("7tbsm").tagName).toBe("SPAN");
  });

  it("fires an instance toggle when the pill is clicked", () => {
    const onFilterToggle = vi.fn();
    render(<LogLine line={baseLine} onFilterToggle={onFilterToggle} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Filter by instance 7tbsm/ }),
    );
    expect(onFilterToggle).toHaveBeenCalledWith(
      { facet: "instance", value: "7tbsm" },
      // Source line id is forwarded as the wave-anchor origin so the
      // converging-wave stagger radiates from the line the user
      // clicked on. See LogExplorer.dispatchFilter.
      "log_0001",
    );
  });

  it("fires a level toggle when an ERROR badge is clicked", () => {
    const onFilterToggle = vi.fn();
    render(
      <LogLine
        line={{ ...baseLine, level: "ERROR", message: "db refused" }}
        onFilterToggle={onFilterToggle}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Filter by level ERROR/ }),
    );
    expect(onFilterToggle).toHaveBeenCalledWith(
      { facet: "level", value: "ERROR" },
      "log_0001",
    );
  });

  it("does not render a level button for INFO lines (no badge)", () => {
    const onFilterToggle = vi.fn();
    render(<LogLine line={baseLine} onFilterToggle={onFilterToggle} />);
    expect(
      screen.queryByRole("button", { name: /Filter by level/ }),
    ).not.toBeInTheDocument();
  });

  it("fires a request-id toggle when the request-id badge is clicked", () => {
    const onFilterToggle = vi.fn();
    render(
      <LogLine
        line={{ ...baseLine, requestId: "req_a3f9c2" }}
        onFilterToggle={onFilterToggle}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Filter by request id req_a3f9c2/ }),
    );
    expect(onFilterToggle).toHaveBeenCalledWith(
      { facet: "requestId", value: "req_a3f9c2" },
      "log_0001",
    );
  });
});

describe("LogLine — deploy boundaries", () => {
  const deployLine: LogLineType = {
    ...baseLine,
    id: "log_deploy",
    isDeployBoundary: true,
    message: "🎉 Deploy live · srv-7tbsm@a3f2c1",
  };

  it("renders deploy boundaries with the separator role", () => {
    render(<LogLine line={deployLine} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("includes the deploy message text", () => {
    render(<LogLine line={deployLine} />);
    expect(
      screen.getByText("🎉 Deploy live · srv-7tbsm@a3f2c1"),
    ).toBeInTheDocument();
  });

  it("does not render the time / instance columns for deploy boundaries", () => {
    render(<LogLine line={deployLine} />);
    expect(screen.queryByText("14:32:08")).not.toBeInTheDocument();
    expect(screen.queryByText("7tbsm")).not.toBeInTheDocument();
  });
});
