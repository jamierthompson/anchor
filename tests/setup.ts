/*
 * Test setup. Loaded once before any test file runs (configured via
 * setupFiles in vitest.config.ts).
 *
 * Imports the jest-dom matchers and registers them on Vitest's expect.
 * After this runs, tests can use matchers like:
 *   expect(element).toBeInTheDocument()
 *   expect(element).toHaveTextContent("...")
 *   expect(element).toBeVisible()
 *
 * Without this file, those matchers would not be available and tests
 * would have to rely on Vitest's much more limited built-in matchers.
 */
import "@testing-library/jest-dom/vitest";
