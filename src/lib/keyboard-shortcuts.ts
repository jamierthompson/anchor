/**
 * Single source of truth for the keyboard bindings shown in the
 * shortcuts surface.
 *
 * The actual key handlers do their own case-by-case key detection;
 * this file's job is purely to feed the surface's render.
 *
 * Anything that lands here must already be wired in a real handler;
 * the surface shouldn't advertise bindings that don't fire. The
 * reverse — bindings that fire but aren't listed here — is also a
 * bug; keep this list aligned when adding new bindings.
 *
 * TODO: key handlers do their own detection; consolidating them on
 * this registry would remove the duplication.
 */

/**
 * One physical key cap to render.
 *
 * `keys` is an array because some bindings are key combinations —
 * the surface renders them as adjacent keycaps joined by "+".
 * Single-key bindings have a one-element array.
 *
 * `aliases` are EQUIVALENT bindings that produce the same action.
 * They render with a "/" separator to communicate "either of these
 * works" without showing the same description twice. The handler
 * treats aliases as truly equivalent — neither is preferred.
 */
export type KeyCap = {
  /**
   * Sequential keys for a combination, rendered as adjacent caps.
   */
  keys: readonly string[];
  /**
   * Alternative keycap sequences that bind to the same action.
   * Empty for single-binding shortcuts.
   */
  aliases?: readonly (readonly string[])[];
};

export type Shortcut = {
  /** Keys to render as physical keycaps. */
  caps: KeyCap;
  /** Short user-facing description of what the binding does. */
  description: string;
};

export type ShortcutGroup = {
  /** Section heading shown above the keycap rows. */
  title: string;
  shortcuts: readonly Shortcut[];
};

/**
 * The full shortcut registry. Order matters — both within groups
 * (most-likely-used first) and across groups (Navigation first
 * matches user mental model of "how do I move around").
 *
 * Keep aligned with the actual key handlers — every binding listed
 * here should fire in code, and every binding that fires in code
 * should be listed here.
 */
export const KEYBOARD_SHORTCUTS: readonly ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      {
        caps: { keys: ["J"], aliases: [["↓"]] },
        description: "Next Visible Line",
      },
      {
        caps: { keys: ["K"], aliases: [["↑"]] },
        description: "Previous Visible Line",
      },
      {
        caps: { keys: ["G"] },
        description: "First Visible Line",
      },
      {
        caps: { keys: ["Shift", "G"] },
        description: "Last Visible Line",
      },
      {
        caps: { keys: ["["] },
        description: "Previous Deploy Boundary",
      },
      {
        caps: { keys: ["]"] },
        description: "Next Deploy Boundary",
      },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      {
        caps: { keys: ["E"], aliases: [["Enter"]] },
        description: "Toggle Context on Focused Line",
      },
      {
        caps: { keys: ["Shift", "E"] },
        description: "Expand Context Window",
      },
    ],
  },
  {
    title: "Dismiss",
    shortcuts: [
      {
        caps: { keys: ["Esc"] },
        description: "Close / Clear",
      },
    ],
  },
  {
    title: "Help",
    shortcuts: [
      {
        caps: { keys: ["?"] },
        description: "Open This Shortcut Sheet",
      },
    ],
  },
] as const;
