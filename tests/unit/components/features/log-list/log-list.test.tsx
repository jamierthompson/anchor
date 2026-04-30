import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogList } from "@/components/features/log-list/log-list";
import type { DerivedLogLine, LogLine } from "@/types/log";

/** Helper — promotes a raw line to a derived one with explicit visibility. */
const derive = (
  line: LogLine,
  flags: { isVisible?: boolean; isDimmed?: boolean } = {},
): DerivedLogLine => ({
  ...line,
  isVisible: flags.isVisible ?? true,
  isDimmed: flags.isDimmed ?? false,
});

const sampleLines: DerivedLogLine[] = [
  derive({
    id: "log_0001",
    timestamp: Date.UTC(2026, 3, 27, 14, 0, 0),
    instance: "7tbsm",
    level: "INFO",
    message: "Server listening on port 3000",
  }),
  derive({
    id: "log_0002",
    timestamp: Date.UTC(2026, 3, 27, 14, 0, 5),
    instance: "a3kx2",
    level: "WARN",
    message: "Cache miss rate elevated",
  }),
  derive({
    id: "log_0003",
    timestamp: Date.UTC(2026, 3, 27, 14, 0, 10),
    instance: "7tbsm",
    level: "INFO",
    message: "🎉 Deploy live · srv-7tbsm@a3f2c1",
    isDeployBoundary: true,
  }),
];

describe("LogList", () => {
  it("renders one item per line passed in", () => {
    const { container } = render(<LogList lines={sampleLines} />);
    expect(container.querySelectorAll("li")).toHaveLength(sampleLines.length);
  });

  it("renders the lines' content (regular and deploy)", () => {
    render(<LogList lines={sampleLines} />);
    expect(
      screen.getByText("Server listening on port 3000"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cache miss rate elevated/)).toBeInTheDocument();
    expect(
      screen.getByText("🎉 Deploy live · srv-7tbsm@a3f2c1"),
    ).toBeInTheDocument();
  });

  it("preserves order when rendering", () => {
    const { container } = render(<LogList lines={sampleLines} />);
    const items = Array.from(container.querySelectorAll("li"));
    expect(items[0].textContent).toContain("Server listening on port 3000");
    expect(items[1].textContent).toContain("Cache miss rate elevated");
    expect(items[2].textContent).toContain("🎉 Deploy live");
  });

  it("renders an empty list when given no lines", () => {
    const { container } = render(<LogList lines={[]} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
    // The container element itself should still exist.
    expect(container.querySelector("ul")).not.toBeNull();
  });

  it("keeps every line in the DOM regardless of visibility — hiding is animated, not unmounted", () => {
    // The fixed-array commitment: filtering must not unmount lines, so a
    // hidden line still renders as an <li>; only `data-visible="false"`
    // changes and Motion animates height/opacity to 0. Stable identity
    // is what makes the animation possible.
    const lines: DerivedLogLine[] = sampleLines.map((line, index) =>
      derive(line, { isVisible: index !== 1 }),
    );
    const { container } = render(<LogList lines={lines} />);
    const items = Array.from(container.querySelectorAll("li"));
    expect(items).toHaveLength(3);
    expect(items[0].getAttribute("data-visible")).toBe("true");
    expect(items[1].getAttribute("data-visible")).toBe("false");
    expect(items[2].getAttribute("data-visible")).toBe("true");
  });

  it("tags every line with data-line-id matching its id (queryable for the scroll anchor)", () => {
    // Anchor mechanics in LogExplorer query the viewport for
    // `[data-line-id="${id}"]` to read the selected line's bounding
    // rect — the attribute presence is a load-bearing invariant.
    const { container } = render(<LogList lines={sampleLines} />);
    const items = Array.from(container.querySelectorAll("li"));
    sampleLines.forEach((line, index) => {
      expect(items[index].getAttribute("data-line-id")).toBe(line.id);
    });
  });

  it("marks dimmed lines via data-dimmed for opacity styling", () => {
    const lines: DerivedLogLine[] = [
      derive(sampleLines[0], { isDimmed: true }),
      derive(sampleLines[1]),
    ];
    const { container } = render(<LogList lines={lines} />);
    const items = Array.from(container.querySelectorAll("li"));
    expect(items[0].getAttribute("data-dimmed")).toBe("true");
    expect(items[1].getAttribute("data-dimmed")).toBe("false");
  });

  it("marks every line whose id is in selectedContextLineIds via data-selected (multi-context support)", () => {
    // The Set carries the "is this line selected?" check used to drive
    // the selection accent. Two entries → both matching <li>s carry
    // the accent flag; the third stays unselected.
    const selectedContextLineIds = new Set([
      sampleLines[0].id,
      sampleLines[1].id,
    ]);
    const { container } = render(
      <LogList
        lines={sampleLines}
        selectedContextLineIds={selectedContextLineIds}
      />,
    );
    const items = Array.from(container.querySelectorAll("li"));
    expect(items[0].getAttribute("data-selected")).toBe("true");
    expect(items[1].getAttribute("data-selected")).toBe("true");
    expect(items[2].getAttribute("data-selected")).toBe("false");
  });
});
