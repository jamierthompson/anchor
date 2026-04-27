import type { LogLine as LogLineType, Level } from "@/types/log";

import styles from "./log-line.module.css";

/**
 * Static renderer for a single log line.
 *
 * Two render shapes:
 *   - Deploy-boundary lines render as a centered horizontal rule with
 *     the deploy text inline. They have no time / instance / message
 *     columns and stay visible regardless of filter once that logic
 *     comes online.
 *   - Regular lines render as a three-column grid: time, instance pill,
 *     message. WARN and ERROR levels are prefixed with a colored level
 *     word; DEBUG dims the entire message; INFO uses the default text
 *     color. Request IDs append as a small badge at the end of the
 *     message column.
 *
 * No interactive state is wired yet (no click handlers, no selection,
 * no hover affordances). Those arrive in later tasks.
 */

const LEVEL_PREFIX: Record<Level, string | null> = {
  INFO: null,
  WARN: "WARN",
  ERROR: "ERROR",
  DEBUG: null,
};

const LEVEL_PREFIX_CLASS: Record<"WARN" | "ERROR", string> = {
  WARN: styles.levelWARN,
  ERROR: styles.levelERROR,
};

function formatTime(timestamp: number): string {
  // UTC formatting keeps the rendered output deterministic across test
  // environments and locales. Real-product time-zone handling is a later
  // concern (see the time-format toggle in the spec).
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
    d.getUTCSeconds(),
  )}`;
}

export function LogLine({ line }: { line: LogLineType }) {
  if (line.isDeployBoundary) {
    return (
      <div className={styles.deployBoundary} role="separator">
        <span className={styles.deployRule} aria-hidden="true" />
        <span className={styles.deployText}>{line.message}</span>
        <span className={styles.deployRule} aria-hidden="true" />
      </div>
    );
  }

  const prefix = LEVEL_PREFIX[line.level];
  const messageClass =
    line.level === "DEBUG" ? styles.messageMuted : styles.message;

  return (
    <div className={styles.line} data-level={line.level}>
      <time
        className={styles.time}
        dateTime={new Date(line.timestamp).toISOString()}
      >
        {formatTime(line.timestamp)}
      </time>
      <span className={styles.instance}>{line.instance}</span>
      <span className={messageClass}>
        {prefix && (
          <span
            className={
              LEVEL_PREFIX_CLASS[line.level as "WARN" | "ERROR"]
            }
          >
            {prefix}
          </span>
        )}
        {prefix ? ` ${line.message}` : line.message}
        {line.requestId && (
          <span className={styles.requestId}>{line.requestId}</span>
        )}
      </span>
    </div>
  );
}
