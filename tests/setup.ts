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

/*
 * jsdom doesn't implement layout-related scroll APIs. Element
 * .scrollIntoView() routes to Window.scrollTo() internally there,
 * which jsdom logs as "Not implemented" on every call — noisy under
 * keyboard-navigation tests where every focus change scrolls. Stubbing
 * both with no-ops here keeps test output readable; production code
 * that relies on the real behavior is exercised in the browser, not
 * in unit tests.
 */
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

/*
 * jsdom doesn't ship ResizeObserver. Radix Scroll Area and Dialog
 * both set one up in a layout effect to size their content, throwing
 * a ReferenceError under tests that mount those primitives. A no-op
 * class is enough for unit tests — we don't exercise the
 * resize-driven layout, just the rendered DOM.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
  ResizeObserverStub as unknown as typeof ResizeObserver;
