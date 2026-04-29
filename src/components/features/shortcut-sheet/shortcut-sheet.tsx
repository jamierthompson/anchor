"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CircleHelp } from "lucide-react";
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
 *   - Open via the `?` keyboard shortcut OR the bottom-right `?`
 *     trigger button (rendered by `ShortcutSheetTrigger` below).
 *   - Close via Esc, click outside, or the modal's own X button —
 *     all handled natively by Radix Dialog.
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
            Keyboard shortcuts
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
                        {shortcut.icon ? (
                          <shortcut.icon
                            aria-hidden="true"
                            size={14}
                            className={styles.descriptionIcon}
                          />
                        ) : null}
                        <span>{shortcut.description}</span>
                      </span>
                      <KeyCapDisplay caps={shortcut.caps} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <Dialog.Close className={styles.closeButton} aria-label="Close">
            <CloseIcon />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Bottom-right floating `?` button. Renders as a sibling to the log
 * explorer at the layout-root level so it floats over content
 * regardless of scroll position. Visual treatment is a circular
 * elevated affordance — familiar "help corner" mental model.
 */
export function ShortcutSheetTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className={styles.floatingTrigger}
      aria-label="Open keyboard shortcuts"
      onClick={onOpen}
    >
      <CircleHelp aria-hidden="true" size={18} />
    </button>
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

/** Inline X icon for the close button — kept local to avoid an icon import for one usage. */
function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}
