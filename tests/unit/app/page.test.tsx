import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";
import { mockLogs } from "@/lib/mock-logs";

/**
 * Smoke test for the home page.
 *
 * The home page is wired to render the full mock log fixture through
 * the LogList component, so this test asserts the wiring without
 * duplicating the granular tests on LogList and LogLine — it just
 * confirms the page mounts and produces one <li> per fixture line.
 */
describe("Home page", () => {
  it("renders the LogList with every mock fixture line", () => {
    const { container } = render(<Home />);
    expect(container.querySelectorAll("li")).toHaveLength(mockLogs.length);
  });
});
