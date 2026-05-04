"use client";

import { ArrowDown } from "lucide-react";

import styles from "./unread-strip.module.css";

/**
 * Click-to-scroll affordance shown at the bottom of the explorer
 * while the user is scrolled away from the tail and new lines have
 * streamed in. Pure render — count + onClick are owned by
 * LogExplorer. Returns null when count <= 0 so there's no DOM or
 * event listener while there's nothing unread.
 *
 * The visible label's aria-label provides the conventional sentence-case form for AT.
 */
export function UnreadStrip({
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
      className={styles.strip}
      onClick={onClick}
      aria-label={`Scroll to ${count} new lines`}
    >
      <ArrowDown
        aria-hidden="true"
        size={12}
        className={styles.arrow}
      />
      <span>
        <span className={styles.count}>{count}</span> NEW LINES
      </span>
    </button>
  );
}