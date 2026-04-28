"use client";

import * as Popover from "@radix-ui/react-popover";
import { type Dispatch, type ReactNode } from "react";

import {
  type FilterAction,
  type FilterState,
} from "@/lib/filter-state";
import { INSTANCES, REQUEST_IDS } from "@/lib/mock-logs";
import type { Level } from "@/types/log";

import styles from "./filter-bar.module.css";

/**
 * Filter bar — sits above the log list (spec §9.1).
 *
 * Two halves: a Radix Popover trigger ("+ Add filter") and the row of
 * active chips. Both are pure presentation over the parent's filter
 * state — this component holds no state of its own beyond the popover's
 * open/closed (managed by Radix).
 *
 * The popover content is split into three sections (Instance / Request
 * ID / Level), each a list of toggleable values sourced from the mock
 * fixture. No search input — spec is explicit on that.
 *
 * Chips render in fixture order: instances first, then request ids,
 * then levels. Same-type chips appear adjacent so the OR-within-type
 * relationship is visually implicit (spec §3).
 *
 * The chip body itself is inert in this commit. The cmd/ctrl + click
 * handler that clears all filters of a type lands in commit #6 of this
 * branch.
 */

const REQUEST_ID_VALUES = Object.keys(REQUEST_IDS);
const LEVELS: readonly Level[] = ["INFO", "WARN", "ERROR", "DEBUG"];

type FilterBarProps = {
  state: FilterState;
  dispatch: Dispatch<FilterAction>;
};

export function FilterBar({ state, dispatch }: FilterBarProps) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="Log filters">
      <AddFilterPopover state={state} dispatch={dispatch} />
      {state.instances.map((value) => (
        <Chip
          key={`instance-${value}`}
          label={`instance: ${value}`}
          onRemove={() => dispatch({ type: "toggleInstance", value })}
        />
      ))}
      {state.requestIds.map((value) => (
        <Chip
          key={`request-${value}`}
          label={value}
          onRemove={() => dispatch({ type: "toggleRequestId", value })}
        />
      ))}
      {state.levels.map((value) => (
        <Chip
          key={`level-${value}`}
          label={`level: ${value.toLowerCase()}`}
          onRemove={() => dispatch({ type: "toggleLevel", value })}
        />
      ))}
    </div>
  );
}

function AddFilterPopover({ state, dispatch }: FilterBarProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className={styles.addTrigger}>
          <span aria-hidden="true" className={styles.addPlus}>
            +
          </span>
          Add filter
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.popoverContent}
          sideOffset={6}
          align="start"
        >
          <Section title="Instance">
            {INSTANCES.map((value) => (
              <ToggleRow
                key={value}
                label={value}
                isActive={state.instances.includes(value)}
                onClick={() =>
                  dispatch({ type: "toggleInstance", value })
                }
              />
            ))}
          </Section>
          <Section title="Request ID">
            {REQUEST_ID_VALUES.map((value) => (
              <ToggleRow
                key={value}
                label={value}
                isActive={state.requestIds.includes(value)}
                onClick={() =>
                  dispatch({ type: "toggleRequestId", value })
                }
              />
            ))}
          </Section>
          <Section title="Level">
            {LEVELS.map((value) => (
              <ToggleRow
                key={value}
                label={value.toLowerCase()}
                isActive={state.levels.includes(value)}
                onClick={() => dispatch({ type: "toggleLevel", value })}
              />
            ))}
          </Section>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.sectionRows}>{children}</div>
    </div>
  );
}

/**
 * A single toggleable value in the popover. `aria-pressed` on a button
 * is the standard pattern for binary on/off state and keeps the popover
 * usable with assistive tech without inventing a custom role.
 */
function ToggleRow({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.toggleRow}
      aria-pressed={isActive}
      data-active={isActive}
      onClick={onClick}
    >
      <span className={styles.toggleCheck} aria-hidden="true">
        {isActive ? "✓" : ""}
      </span>
      <span className={styles.toggleLabel}>{label}</span>
    </button>
  );
}

function Chip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className={styles.chip}>
      <span className={styles.chipLabel}>{label}</span>
      <button
        type="button"
        className={styles.chipRemove}
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
      >
        <span aria-hidden="true">×</span>
      </button>
    </span>
  );
}
