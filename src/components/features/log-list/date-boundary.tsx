import styles from "./date-boundary.module.css";

const FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/*
 * Format the timestamp as `MON, APR 27`. Intl.DateTimeFormat returns mixed-case ("Mon, Apr 27").
 *
 * Forced UTC so the rendered date is deterministic across CI runs and
 * the user's local timezone. The mock fixture's timestamps are UTC by
 * construction, so there's no display-vs-data drift.
 */
function formatDateLabel(timestamp: number): string {
  return FORMATTER.format(new Date(timestamp))
    .replace(/,\s/, ", ")
    .toUpperCase();
}

/**
 * Sticky day marker that pins to the top of the log scroll viewport
 * while its date's lines are visible.
 */
export function DateBoundary({ timestamp }: { timestamp: number }) {
  return (
    <div
      className={styles.dateBoundary}
      role="separator"
      aria-label={`Date marker: ${formatDateLabel(timestamp)}`}
    >
      <span className={styles.rule} aria-hidden="true" />
      <span className={styles.text}>{formatDateLabel(timestamp)}</span>
      <span className={styles.rule} aria-hidden="true" />
    </div>
  );
}