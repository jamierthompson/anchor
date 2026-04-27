import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import Home from "@/app/page";

/*
 * Sanity test for the home page.
 *
 * This is the first test in the project and serves a dual purpose:
 * it confirms the home page renders the expected heading, AND it
 * exercises the entire test setup end-to-end:
 *
 *   - The @/* path alias resolves (via Vite's native tsconfigPaths)
 *   - JSX/TSX is transformed (via @vitejs/plugin-react)
 *   - render() works in jsdom
 *   - jest-dom matchers are wired up (toBeInTheDocument)
 *
 * If this test passes, the test framework is fully functional and
 * future tests can focus on real behavior.
 */
describe("Home page", () => {
  it("should render the Anchor heading", () => {
    render(<Home />);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: /anchor/i,
    });

    expect(heading).toBeInTheDocument();
  });
});
