"use client";

import styles from "./legend.module.css";

/**
 * Single entry in the contextual legend.
 *
 * `keys` is an optional flat sequence of cap labels — `["Shift", "E"]`
 * renders as two adjacent caps with a `+` separator. Aliases (`J / ↓`)
 * are not supported here; the legend's job is to surface the *most
 * relevant* single binding for the current app state, not to document
 * every equivalent. The shortcut sheet covers the full registry.
 *
 * Omitting `keys` is meaningful — it produces a label-only entry,
 * which we use for "the binding still exists but has nowhere to go
 * from this state" messaging (e.g. shift+e at the file boundary).
 * Hiding the caps for that case is clearer than dimming them; the
 * user's eye lands on the message rather than parsing whether a faded
 * keycap is still active.
 *
 * `onClick` is optional. When present, the entry is rendered as a
 * `<button>` (mouse-clickable to fire the action — currently used by
 * the `?` entry to open the shortcut sheet without a separate FAB).
 * When absent, the entry is rendered as a `<div>` — purely a visual
 * hint for a keyboard shortcut.
 */
export type LegendItem = {
  /** Sequence of cap labels (e.g. `["Shift", "E"]`). Omit for label-only entries. */
  keys?: readonly string[];
  /** User-facing description; rendered uppercase + muted. */
  label: string;
  /** When set, the entry is rendered as a clickable button. */
  onClick?: () => void;
  /**
   * Required when `onClick` is set — the accessible name for the
   * button (the visible label is `KEYS LABEL`, which screen readers
   * can read literally, but a clearer aria-label like "Open keyboard
   * shortcuts" reads better).
   */
  ariaLabel?: string;
};

/**
 * Top-right contextual legend for the log explorer.
 *
 * Single-slot in current usage — LogExplorer passes one item at a time
 * based on app state — but the API takes an array so future surfaces
 * (e.g. a multi-binding cheat strip) drop in without an API change.
 *
 * Visual treatment: physical-looking keycaps (matching the shortcut
 * sheet's language) followed by a muted, all-caps label. The keycaps
 * carry meaning; the label is supporting copy.
 *
 * Why it replaces the bottom-right floating `?` FAB:
 *
 *   - The `?` binding still works keyboard-first, but the FAB had no
 *     other role to play and read as visual noise.
 *   - When app state suggests a *different* binding is more relevant
 *     (shift+e while a context is open), the legend swaps to that
 *     hint. A FAB couldn't serve that role.
 *   - When no context-relevant hint applies, the legend falls back to
 *     `? for all shortcuts` — same affordance the FAB used to be,
 *     just integrated into the toolbar instead of floating in a
 *     corner by itself.
 */
export function Legend({
  items,
  pulseKey,
}: {
  items: readonly LegendItem[];
  /**
   * Bumped by the parent on every event the legend should visibly
   * acknowledge (e.g. each successful shift+e expansion). Used as
   * part of each entry's React key so React remounts the entry,
   * which re-fires the CSS mount animation. Without this, two back-
   * to-back actions where the legend's text is identical would look
   * the same — the user couldn't tell their key registered.
   */
  pulseKey?: number;
}) {
  if (items.length === 0) return null;

  return (
    <div className={styles.legend} role="toolbar" aria-label="Keyboard hints">
      {items.map((item, idx) => (
        <LegendEntry key={`${pulseKey ?? 0}-${idx}`} item={item} />
      ))}
    </div>
  );
}

function LegendEntry({ item }: { item: LegendItem }) {
  const hasKeys = item.keys && item.keys.length > 0;
  const content = (
    <>
      {hasKeys ? (
        <span className={styles.caps} aria-hidden="true">
          {item.keys!.map((key, keyIdx) => (
            <span key={keyIdx} className={styles.capPair}>
              {keyIdx > 0 ? <span className={styles.plus}>+</span> : null}
              <kbd className={styles.cap}>{key}</kbd>
            </span>
          ))}
        </span>
      ) : null}
      <span className={styles.label}>{item.label}</span>
    </>
  );

  if (item.onClick) {
    return (
      <button
        type="button"
        className={styles.entry}
        aria-label={item.ariaLabel}
        onClick={item.onClick}
      >
        {content}
      </button>
    );
  }

  return <div className={styles.entry}>{content}</div>;
}
