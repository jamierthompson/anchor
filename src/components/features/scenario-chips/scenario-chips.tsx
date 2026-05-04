"use client";

import type { Dispatch } from "react";

import { Chip } from "@/components/ui/chip/chip";
import {
  filterStatesEqual,
  initialFilterState,
  type FilterAction,
  type FilterState,
} from "@/lib/filter-state";

import styles from "./scenario-chips.module.css";

/**
 * Scenario chip bar — three preset filter states the user can toggle on
 * and off.
 *
 * Behavior:
 *   - Mutually exclusive: at most one chip is active at a time. Clicking
 *     a chip applies its preset; clicking the active chip again clears
 *     the filter back to the empty state.
 *   - "Active" is derived purely by comparing the current FilterState to
 *     each preset — no separate "selected chip" state. Single source of
 *     truth stays in the reducer.
 *
 * Each preset is an explicit FilterState object. Scenarios were chosen
 * to exercise the three demo-relevant filtering surfaces:
 *   - Errors only — the "show me what broke" filter;
 *     demonstrates how cross-instance INFO traffic keeps flowing while
 *     one instance degrades.
 *   - Trace req_b81k4m — the "trace one request" demo; this id appears
 *     in both the healthy phase and the error cluster, so opening
 *     context on a healthy occurrence vs. a failing one is the headline
 *     anchor flow.
 *   - Instance 7tbsm — the "narrow to one server" demo; 7tbsm is the
 *     instance that degrades and gets rolled back.
 */

type Scenario = {
  readonly id: string;
  readonly label: string;
  readonly state: FilterState;
};

const SCENARIOS: readonly Scenario[] = [
  {
    id: "errors",
    label: "Errors only",
    state: { instances: [], requestIds: [], levels: ["ERROR"] },
  },
  {
    id: "trace",
    label: "Trace req_b81k4m",
    state: { instances: [], requestIds: ["req_b81k4m"], levels: [] },
  },
  {
    id: "instance",
    label: "Instance 7tbsm",
    state: { instances: ["7tbsm"], requestIds: [], levels: [] },
  },
];

type ScenarioChipsProps = {
  state: FilterState;
  dispatch: Dispatch<FilterAction>;
};

export function ScenarioChips({ state, dispatch }: ScenarioChipsProps) {
  const handleClick = (scenario: Scenario) => {
    if (filterStatesEqual(state, scenario.state)) {
      dispatch({ type: "clear" });
      return;
    }
    dispatch({ type: "setFilter", state: scenario.state });
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.eyebrow}>Filters</h2>
      <div className={styles.bar} role="toolbar" aria-label="Filter scenarios">
        {SCENARIOS.map((scenario) => {
          const isActive = filterStatesEqual(state, scenario.state);
          return (
            <Chip
              key={scenario.id}
              active={isActive}
              onClick={() => handleClick(scenario)}
            >
              {scenario.label}
            </Chip>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The empty filter state. Re-exported so consumers (and tests) can
 * reference the "all chips off" target without reaching into the
 * reducer module directly.
 */
export const EMPTY_FILTER_STATE = initialFilterState;
