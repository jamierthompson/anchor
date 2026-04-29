/**
 * Plain-text formatting for the "Copy line" action (spec §8 — replaces
 * the originally-planned kebab "Copy line" menu item, now exposed as a
 * hover icon button + the `c` keyboard shortcut).
 *
 * Format goal: enough context to identify the line in a bug report or
 * Slack message without needing to share the whole UI. The shape
 * mirrors what a developer reading the rendered line would type out by
 * hand.
 *
 *   2026-04-27T14:32:08.000Z [7tbsm] GET /api/users 200 in 42ms req_a3f9c2
 *   2026-04-27T14:32:09.000Z [7tbsm] WARN Slow query took 1247ms
 *   🎉 Deploy live · srv-7tbsm@a3f2c1
 *
 * Design choices:
 *   - ISO 8601 timestamp (full precision). Pasteable into log search
 *     tools that expect machine-readable times.
 *   - Instance in square brackets — visually echoes the rendered pill.
 *   - Level prefix only for WARN / ERROR. INFO lines have no level
 *     marker in the UI; matching that keeps the copy faithful to what
 *     the user sees. DEBUG also no prefix (UI dims the message instead).
 *   - Request id at the end, space-separated. No surrounding decoration.
 *   - Deploy boundaries copy their `message` field as-is (no timestamp /
 *     instance — they're presented as section markers, not events).
 *
 * Pure function on purpose: testable in isolation, no React, no
 * clipboard dependency.
 */

import type { Level, LogLine } from "@/types/log";

const LEVEL_COPY_PREFIX: Record<Level, string> = {
  INFO: "",
  WARN: "WARN ",
  ERROR: "ERROR ",
  DEBUG: "",
};

export function formatLineForCopy(line: LogLine): string {
  if (line.isDeployBoundary) return line.message;

  const ts = new Date(line.timestamp).toISOString();
  const prefix = LEVEL_COPY_PREFIX[line.level];
  const reqSuffix = line.requestId ? ` ${line.requestId}` : "";
  return `${ts} [${line.instance}] ${prefix}${line.message}${reqSuffix}`;
}
