"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { Dispatch, SetStateAction } from "react";

import {
  KEYBOARD_SHORTCUTS,
  type KeyCap as KeyCapType,
} from "@/lib/keyboard-shortcuts";

import styles from "./shortcut-sheet.module.css";

/**
 * Modal overlay listing every keyboard binding.
 *
 * Renders as physical-looking key caps grouped by function rather
 * than a generic table. Styling lives in the sibling .module.css and
 * uses stacked shadows + a top-light gradient on each cap to read as
 * dimensional without being kitsch.
 *
 * **Open / close model**:
 *   - Open via the `?` keyboard shortcut OR by clicking the legend's
 *     `?` entry in the top-right toolbar (see `Legend` in
 *     components/features/legend).
 *   - Close via Esc or click-outside — both handled natively by
 *     Radix Dialog. There's no in-modal close affordance: the sheet
 *     itself documents Esc as the dismissal binding, and removing
 *     the X reduces visual clutter inside an already help-dense
 *     surface.
 *
 * Open state is OWNED by LogExplorer (controlled). The keyboard
 * shortcut needs to flip state from outside the dialog tree, so a
 * Radix-internal uncontrolled `Trigger` won't cut it.
 *
 * Esc precedence cascade — sheet open is step #1. Radix
 * Dialog calls preventDefault when handling Esc internally, which
 * makes our document-level Esc handler's `event.defaultPrevented`
 * bail out, so contexts don't get cleared as a side effect.
 *
 * The `?` keyboard binding does NOT toggle (close-when-already-open).
 * Open-only matches the user's mental model for help affordances and
 * keeps Esc as the one consistent close.
 */
export function ShortcutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <Dialog.Title className={styles.title}>
            Keyboard Shortcuts
          </Dialog.Title>
          <div className={styles.groups}>
            {KEYBOARD_SHORTCUTS.map((group) => (
              <section key={group.title} className={styles.group}>
                <h3 className={styles.groupTitle}>{group.title}</h3>
                <ul className={styles.shortcutList}>
                  {group.shortcuts.map((shortcut) => (
                    <li
                      key={shortcut.description}
                      className={styles.shortcutRow}
                    >
                      <span className={styles.description}>
                        {shortcut.description}
                      </span>
                      <KeyCapDisplay caps={shortcut.caps} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Renders one shortcut's keycap sequence + any aliases. A single
 * binding (`E`) renders as one cap; a combo (`Shift + E`) renders
 * as two caps with a "+" separator; aliases render as a "/"
 * separator between two cap sequences (`J / ↓`).
 */
function KeyCapDisplay({ caps }: { caps: KeyCapType }) {
  const sequences: readonly (readonly string[])[] = [
    caps.keys,
    ...(caps.aliases ?? []),
  ];

  return (
    <span className={styles.keyCapGroup} aria-hidden="true">
      {sequences.map((seq, seqIdx) => (
        <span key={seqIdx} className={styles.keyCapSequence}>
          {seqIdx > 0 ? <span className={styles.aliasSeparator}>/</span> : null}
          {seq.map((key, keyIdx) => (
            <span key={keyIdx} className={styles.keyCapPair}>
              {keyIdx > 0 ? <span className={styles.comboPlus}>+</span> : null}
              <kbd className={styles.keyCap}>{key}</kbd>
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

