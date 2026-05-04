import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Demo from "@/app/demo/page";
import { mockLogs } from "@/lib/mock-logs";

/**
 * Smoke test for the /demo page.
 *
 * This test confirms the page mounts
 * and produces one <li> per fixture line, asserting the wiring
 * without duplicating the granular tests on LogList and LogLine.
 */
describe("/demo page", () => {
  it("renders the LogList with every mock fixture line", () => {
    const { container } = render(<Demo />);
    expect(container.querySelectorAll("li")).toHaveLength(mockLogs.length);
  });
});