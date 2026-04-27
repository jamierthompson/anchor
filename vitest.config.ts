import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/*
 * Vitest configuration.
 *
 * Plugins:
 *   - @vitejs/plugin-react: lets Vitest transform JSX/TSX so React
 *     components can be imported and rendered inside tests.
 *
 * Resolve:
 *   - tsconfigPaths: true tells Vite to honor the path aliases in
 *     tsconfig.json so test files can import via `@/foo` like the
 *     application code does. Vite 7+ supports this natively, which
 *     replaces the older vite-tsconfig-paths plugin pattern.
 *
 * Test settings:
 *   - environment: "jsdom" simulates a browser DOM in Node so React
 *     Testing Library can render and query elements without a real
 *     browser.
 *   - globals: true exposes describe/it/expect/etc. as globals,
 *     matching the standard Vitest ergonomics.
 *   - setupFiles: tests/setup.ts wires up the @testing-library/jest-dom
 *     matchers (toBeInTheDocument, toHaveTextContent, etc.).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
