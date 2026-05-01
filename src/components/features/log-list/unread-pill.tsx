"use client";

import { ArrowDown } from "lucide-react";

import styles from "./unread-pill.module.css";

/**
 * Floating pill near the bottom of the log list (spec §9.8) — surfaces
 * the count of unread log entries that have streamed in while the
 * user is scrolled away from the bottom. Click → smooth-scroll to
 * bottom and resume auto-follow.
 *
 * **State model**: this component is a pure render. The unread count
 * lives in LogExplorer (incremented on streamed-line arrival when
 * the user is not at-bottom; reset to 0 when the user reaches bottom
 * or clicks the pill). Pill renders only when `count > 0`.
 *
 * **Positioning**: bottom-center via `position: fixed`, sitting above
 * the log content but below the modal overlay (z-index 40, beneath
 * the `?` button at 50 and the shortcut sheet overlay at 100). The
 * fixed positioning means the pill anchors to the viewport, not the
 * scroll container — convention from Slack / Discord / Console.app
 * "new messages" affordances.
 *
 * Renders `null` when count is 0 — no DOM, no event listeners, no
 * dangling layout. The CSS-driven enter/exit animation keys off
 * mount/unmount so React's natural re-render cycle drives the
 * appearance and disappearance.
 */
export function UnreadPill({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      className={styles.pill}
      onClick={onClick}
      aria-label={`Scroll to ${count} new`}
    >
      <ArrowDown aria-hidden="true" size={12} />
      <span>{count} New</span>
    </button>
  );
}
