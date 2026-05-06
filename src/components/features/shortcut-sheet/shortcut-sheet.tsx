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
 * than a generic table. Styling lives in the sibling stylesheet and
 * uses stacked shadows + a top-light gradient on each cap to read as
 * dimensional without being kitsch.
 *
 * Open is controlled by the parent — the keyboard binding needs to
 * flip state from outside the dialog tree. Dismissal (Esc / click-
 * outside) is owned by the dialog primitive, which preventDefaults
 * so document-level Esc handling sees the event as already consumed
 * and doesn't double-fire as "clear contexts." There's no in-modal
 * close affordance: this surface documents Esc as the dismissal
 * binding, and removing the X reduces clutter inside an already
 * help-dense surface.
 *
 * The activation binding is open-only (not a toggle). Matches the
 * mental model for help affordances and keeps Esc as the one
 * consistent close.
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
 * Renders one shortcut's keycap sequence plus any aliases. A single-
 * key binding renders as one cap; a combo renders as adjacent caps
 * with a "+" separator; aliases render with a "/" separator between
 * cap sequences.
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

