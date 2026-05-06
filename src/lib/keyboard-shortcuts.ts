/**
 * Single source of truth for the keyboard bindings shown in the
 * shortcut sheet.
 *
 * The actual key handlers live elsewhere and do their own case-by-
 * case key detection — refactoring those to consume this registry is
 * a follow-up. For now, this file's job is purely to feed the sheet's
 * render.
 *
 * Anything that lands here must already be wired in a real handler;
 * the sheet shouldn't advertise bindings that don't fire. The reverse —
 * bindings that fire but aren't in the sheet — is also a bug; keep
 * this list aligned when adding new bindings.
 */

/**
 * One physical key cap to render in the sheet.
 *
 * `keys` is an array because some bindings are key combinations
 * (`shift+e`) — the sheet renders them as adjacent keycaps with a
 * "+" separator. Single-key bindings have a one-element array.
 *
 * `aliases` are EQUIVALENT bindings that produce the same action
 * (`j` and `↓` both move focus next). The sheet renders aliases as
 * a `/` separator to communicate "either of these works" without
 * showing the same description twice. The handler treats the aliases
 * as truly equivalent — neither is preferred.
 */
export type KeyCap = {
  /**
   * Sequential keys for a combination (e.g. ["Shift", "E"]).
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
        description: "Expand Context (±20 Lines)",
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
