"use client";

import styles from "./legend.module.css";

/**
 * Single entry in the contextual hint surface.
 *
 * `keys` is an optional flat sequence of cap labels — a two-element
 * sequence renders as two adjacent caps with a `+` separator. Aliases
 * are not supported here; this surface shows the *most relevant*
 * single binding for the current app state, not every equivalent.
 * The dedicated shortcuts surface covers the full registry.
 *
 * Omitting `keys` is meaningful — it produces a label-only entry, used
 * for "the binding still exists but has nowhere to go from this state"
 * messaging. Hiding the caps for that case is clearer than dimming
 * them; the user's eye lands on the message rather than parsing
 * whether a faded keycap is still active.
 *
 * `onClick` is optional. When present, the entry is rendered as a
 * `<button>` so mouse activation fires the same action the keyboard
 * binding would. When absent, the entry is rendered as a `<div>` —
 * purely a visual hint.
 */
export type LegendItem = {
  /** Sequence of cap labels rendered as adjacent keycaps. Omit for label-only entries. */
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
   * animation. Included in the entry's React key so a change forces
   * a remount which replays the CSS keyframe.
   *
   * Per-item rather than per-surface so that a multi-item layout can
   * pulse just the one entry whose action fired — entries that didn't
   * fire shouldn't flash on every press.
   */
  pulseKey?: number;
};

/**
 * Top-of-page contextual hint surface for the log explorer.
 *
 * Dual purpose: surfaces the most relevant keyboard shortcuts for the
 * current app state (the keycaps document the binding), AND doubles
 * as the mouse path for those same actions — every entry is a
 * clickable button that fires the same handler the keyboard binding
 * would.
 *
 * Accepts multiple items so a small cluster of relevant bindings can
 * surface concurrently when more than one action is meaningful at
 * once.
 *
 * Visual treatment: physical-looking keycaps followed by a muted,
 * all-caps label. The keycaps carry meaning; the label is supporting
 * copy.
 */
export function Legend({ items }: { items: readonly LegendItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className={styles.legend} role="toolbar" aria-label="Keyboard hints">
      {items.map((item) => (
        // Stable per-entry key (label-based) so an entry persists
        // across state changes when its label is unchanged. Adding
        // `pulseKey` to the key forces a remount only for the entry
        // whose pulseKey just bumped — neighboring entries stay
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
