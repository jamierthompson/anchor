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
 * `<button>` (mouse-clickable to fire the action — used by the `?`
 * entry to open the shortcut sheet, and by the `E` / `Shift+E` /
 * `Esc` entries to fire their respective handlers). When absent,
 * the entry is rendered as a `<div>` — purely a visual hint for a
 * keyboard shortcut.
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
  /**
   * Bumped by the parent to retrigger this specific entry's mount
   * animation. The Legend includes pulseKey in the entry's React key,
   * so a change forces a remount which replays the CSS keyframe.
   *
   * Per-item rather than per-Legend so that a multi-item layout
   * (e.g. [Shift+E, Esc]) can pulse just the one entry whose action
   * fired — the always-present Esc shouldn't flash every time the
   * user expands.
   */
  pulseKey?: number;
};

/**
 * Top-of-page contextual legend for the log explorer.
 *
 * Dual purpose: surfaces the most relevant keyboard shortcuts for
 * the current app state (the keycaps document the binding), AND
 * serves as the mouse path for those same actions (every entry is
 * a clickable button that fires the same handler the keyboard
 * binding would). A legend that's also the mouse command center.
 *
 * Accepts multiple items so the legend can show a small cluster of
 * relevant bindings concurrently (e.g. Shift+E expand, E hide,
 * Esc close) when more than one action is meaningful at once.
 *
 * Visual treatment: physical-looking keycaps (matching the shortcut
 * sheet's language) followed by a muted, all-caps label. The keycaps
 * carry meaning; the label is supporting copy.
 */
export function Legend({ items }: { items: readonly LegendItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className={styles.legend} role="toolbar" aria-label="Keyboard hints">
      {items.map((item) => (
        // Stable per-entry key (label-based) so an entry persists
        // across state changes when its label is unchanged. Adding
        // `pulseKey` to the key forces a remount only for the entry
        // whose pulseKey just bumped — neighbouring entries stay
        // mounted and don't replay the mount animation.
        <LegendEntry
          key={`${item.label}-${item.pulseKey ?? 0}`}
          item={item}
        />
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
