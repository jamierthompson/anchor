/**
 * Single source of truth for the keyboard bindings shown in the
 * shortcut sheet (spec §9.7).
 *
 * The handler in `LogExplorer` still does its own case-by-case key
 * detection (see `handleKeyDown` and the document-level effect for
 * `?` / Esc / `/`) — refactoring that to consume this registry is a
 * follow-up task. For now, this file's job is purely to feed the
 * sheet's render. Both surfaces having to be edited together is the
 * cost; the upside is the sheet ships without a risky handler refactor.
 *
 * **Invariant for editors of this file**: anything that lands here
 * must already be wired in `handleKeyDown` (or the document-level
 * effect). The sheet shouldn't advertise bindings that don't fire.
 * The reverse — bindings that fire but aren't in the sheet — is also
 * a bug; keep this list aligned when adding new bindings.
 */

import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Bookmark,
  Copy,
  ListChevronsUpDown,
  MoveDown,
  MoveUp,
  X,
} from "lucide-react";

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
  /**
   * Optional icon to render alongside the description — gives the
   * sheet visual rhythm and reinforces the action's meaning. Skipped
   * when the action is more abstract (e.g. clear contexts) or has no
   * obvious icon.
   */
  icon?: LucideIcon;
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
 * Keep aligned with the bindings in:
 *   - LogExplorer.handleKeyDown (listbox-level: j/k/g/G/[/]/e/shift+e/c)
 *   - LogExplorer's document-level effect (Esc, ?)
 */
export const KEYBOARD_SHORTCUTS: readonly ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      {
        caps: { keys: ["J"], aliases: [["↓"]] },
        description: "Next visible line",
        icon: MoveDown,
      },
      {
        caps: { keys: ["K"], aliases: [["↑"]] },
        description: "Previous visible line",
        icon: MoveUp,
      },
      {
        caps: { keys: ["G"] },
        description: "First visible line",
        icon: ArrowUpToLine,
      },
      {
        caps: { keys: ["Shift", "G"] },
        description: "Last visible line",
        icon: ArrowDownToLine,
      },
      {
        caps: { keys: ["["] },
        description: "Previous deploy boundary",
      },
      {
        caps: { keys: ["]"] },
        description: "Next deploy boundary",
      },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      {
        caps: { keys: ["E"] },
        description: "Toggle context on focused line",
        icon: Bookmark,
      },
      {
        caps: { keys: ["Shift", "E"] },
        description: "Cycle context size (±20 → ±50 → ±100)",
        icon: ListChevronsUpDown,
      },
      {
        caps: { keys: ["C"] },
        description: "Copy focused line",
        icon: Copy,
      },
    ],
  },
  {
    title: "Contexts",
    shortcuts: [
      {
        caps: { keys: ["Esc"] },
        description: "Clear all open contexts",
        icon: X,
      },
    ],
  },
  {
    title: "Help",
    shortcuts: [
      {
        caps: { keys: ["?"] },
        description: "Open this shortcut sheet",
      },
    ],
  },
] as const;
