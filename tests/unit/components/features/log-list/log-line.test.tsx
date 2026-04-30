import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders the instance, level prefix, and request-id badge as plain (non-interactive) spans", () => {
    // Filtering moved to the scenario-chips bar above the list.
    // Per-line elements are pure presentation — no click-to-filter
    // buttons, no role="button", no aria-label="Filter by …".
    render(
      <LogLine
        line={{ ...baseLine, level: "ERROR", requestId: "req_a3f9c2" }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Filter by/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("7tbsm").tagName).toBe("SPAN");
    expect(screen.getByText("ERROR").tagName).toBe("SPAN");
    expect(screen.getByText("req_a3f9c2").tagName).toBe("SPAN");
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

  it("carries data-selected on the inner line element (drives action-row reveal CSS)", () => {
    // .line[data-selected="true"] .actionRow keeps the row visible
    // even without hover so the user can close an open context. The
    // attribute has to live on the inner .line for the descendant
    // selector to work — both the <li> and the inner div carry it.
    const { container, rerender } = render(<LogLine line={baseLine} />);
    const inner = container.querySelector("[data-level]");
    expect(inner?.getAttribute("data-selected")).toBe("false");

    rerender(<LogLine line={baseLine} isSelected />);
    expect(inner?.getAttribute("data-selected")).toBe("true");
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

describe("LogLine — line actions (spec §8 — hover-revealed icon row)", () => {
  it("renders no actions when no onToggleContext is supplied (static-render path)", () => {
    render(<LogLine line={baseLine} />);
    expect(
      screen.queryByRole("button", { name: /View context/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Copy line/ }),
    ).not.toBeInTheDocument();
  });

  it("renders no actions when the §3 gate fails (no filter, no open context)", () => {
    // canToggleContext=false AND isSelected=false → no action would
    // make sense on this line, so the row hides entirely.
    render(
      <LogLine
        line={baseLine}
        onToggleContext={() => {}}
        canToggleContext={false}
        isSelected={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /View context/ }),
    ).not.toBeInTheDocument();
  });

  it("renders the View context + Copy actions when the §3 gate passes", () => {
    render(
      <LogLine
        line={baseLine}
        onToggleContext={() => {}}
        onCopyLine={() => {}}
        canToggleContext
      />,
    );
    expect(
      screen.getByRole("button", { name: /View context/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copy line/ }),
    ).toBeInTheDocument();
  });

  it("flips the toggle label to 'Hide context' and marks the button active when isSelected", () => {
    render(
      <LogLine
        line={baseLine}
        onToggleContext={() => {}}
        canToggleContext
        isSelected
      />,
    );
    const toggle = screen.getByRole("button", { name: /Hide context/ });
    expect(toggle).toBeInTheDocument();
    expect(toggle.getAttribute("data-active")).toBe("true");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking the View/Hide context button calls onToggleContext with the line id", async () => {
    const user = userEvent.setup();
    const onToggleContext = vi.fn();
    render(
      <LogLine
        line={baseLine}
        onToggleContext={onToggleContext}
        canToggleContext
      />,
    );
    await user.click(screen.getByRole("button", { name: /View context/ }));
    expect(onToggleContext).toHaveBeenCalledWith(baseLine.id);
  });

  it("does not render Expand or Less context buttons (keyboard-only via shift+e)", () => {
    // Spec: range expansion is keyboard-only. The mouse buttons used
    // to live in the action row but were removed because expanding
    // context naturally pulls the user's scroll position away from
    // the anchor — they shouldn't have to scroll back to find an
    // in-row button. shift+e works wherever focus is.
    render(
      <LogLine
        line={baseLine}
        onToggleContext={() => {}}
        canToggleContext
        isSelected
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Expand context/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Less context/ }),
    ).not.toBeInTheDocument();
  });

  it("Copy button fires onCopyLine with the line id", async () => {
    const user = userEvent.setup();
    const onCopyLine = vi.fn();
    render(
      <LogLine
        line={baseLine}
        onToggleContext={() => {}}
        onCopyLine={onCopyLine}
        canToggleContext
      />,
    );
    await user.click(screen.getByRole("button", { name: /Copy line/ }));
    expect(onCopyLine).toHaveBeenCalledWith(baseLine.id);
  });
});

describe("LogLine — cmd/ctrl + click toggles context", () => {
  it("cmd + click on the line body fires onToggleContext when the callback is supplied", () => {
    const onToggleContext = vi.fn();
    const { container } = render(
      <LogLine line={baseLine} onToggleContext={onToggleContext} />,
    );
    const inner = container.querySelector("[data-level]")!;
    fireEvent.click(inner, { metaKey: true });
    expect(onToggleContext).toHaveBeenCalledWith(baseLine.id);
  });

  it("plain click (no modifier) does not fire onToggleContext", () => {
    const onToggleContext = vi.fn();
    const { container } = render(
      <LogLine line={baseLine} onToggleContext={onToggleContext} />,
    );
    fireEvent.click(container.querySelector("[data-level]")!);
    expect(onToggleContext).not.toHaveBeenCalled();
  });
});
