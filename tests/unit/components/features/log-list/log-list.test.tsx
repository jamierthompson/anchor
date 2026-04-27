import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogList } from "@/components/features/log-list/log-list";
import type { LogLine } from "@/types/log";

const sampleLines: LogLine[] = [
  {
    id: "log_0001",
    timestamp: Date.UTC(2026, 3, 27, 14, 0, 0),
    instance: "7tbsm",
    level: "INFO",
    message: "Server listening on port 3000",
  },
  {
    id: "log_0002",
    timestamp: Date.UTC(2026, 3, 27, 14, 0, 5),
    instance: "a3kx2",
    level: "WARN",
    message: "Cache miss rate elevated",
  },
  {
    id: "log_0003",
    timestamp: Date.UTC(2026, 3, 27, 14, 0, 10),
    instance: "7tbsm",
    level: "INFO",
    message: "🎉 Deploy live · srv-7tbsm@a3f2c1",
    isDeployBoundary: true,
  },
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
});
