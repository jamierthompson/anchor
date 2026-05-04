import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScenarioChips } from "@/components/features/scenario-chips/scenario-chips";
import { initialFilterState, type FilterState } from "@/lib/filter-state";

/**
 * Coverage for the scenario chip bar — the prototype's only filter
 * surface. Three preset chips, mutually exclusive, with active state
 * derived from the FilterState rather than a separate selection
 * variable.
 *
 * The chip-state mapping (which preset corresponds to which chip) is
 * intentionally not asserted by id — we look up chips by label so the
 * tests survive renames of the internal scenario id field.
 */

const renderBar = (
  state: FilterState,
  dispatch = vi.fn(),
): ReturnType<typeof render> => {
  return render(<ScenarioChips state={state} dispatch={dispatch} />);
};

describe("ScenarioChips", () => {
  it("renders three toggle chips with non-empty labels", () => {
    renderBar(initialFilterState);
    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(3);
    chips.forEach((chip) => expect(chip.textContent?.trim()).toBeTruthy());
  });

  it("none of the chips are active when the filter state is empty", () => {
    renderBar(initialFilterState);
    for (const chip of screen.getAllByRole("button")) {
      expect(chip.getAttribute("data-active")).toBe("false");
      expect(chip.getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("clicking the Errors chip dispatches setFilter with levels=[ERROR]", () => {
    const dispatch = vi.fn();
    renderBar(initialFilterState, dispatch);

    fireEvent.click(screen.getByRole("button", { name: /Errors only/ }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setFilter",
      state: { instances: [], requestIds: [], levels: ["ERROR"] },
    });
  });

  it("clicking the Trace chip dispatches setFilter with the trace request id", () => {
    const dispatch = vi.fn();
    renderBar(initialFilterState, dispatch);

    fireEvent.click(screen.getByRole("button", { name: /Trace req=b81k4m/ }));

    expect(dispatch).toHaveBeenCalledWith({
      type: "setFilter",
      state: { instances: [], requestIds: ["b81k4m"], levels: [] },
    });
  });

  it("clicking the Instance chip dispatches setFilter with the instance id", () => {
    const dispatch = vi.fn();
    renderBar(initialFilterState, dispatch);

    fireEvent.click(screen.getByRole("button", { name: /Instance 7tbsm/ }));

    expect(dispatch).toHaveBeenCalledWith({
      type: "setFilter",
      state: { instances: ["7tbsm"], requestIds: [], levels: [] },
    });
  });

  it("marks the chip whose preset matches the current filter state as active", () => {
    renderBar({ instances: [], requestIds: [], levels: ["ERROR"] });
    const errors = screen.getByRole("button", { name: /Errors only/ });
    expect(errors.getAttribute("data-active")).toBe("true");
    expect(errors.getAttribute("aria-pressed")).toBe("true");

    // The other two presets stay inactive — only one chip can be on at
    // a time because each preset is a fully-specified FilterState and
    // active is derived from equality to that state.
    expect(
      screen.getByRole("button", { name: /Trace/ }).getAttribute("data-active"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: /Instance/ })
        .getAttribute("data-active"),
    ).toBe("false");
  });

  it("clicking the active chip clears the filter (toggle-off)", () => {
    const dispatch = vi.fn();
    renderBar(
      { instances: [], requestIds: [], levels: ["ERROR"] },
      dispatch,
    );

    fireEvent.click(screen.getByRole("button", { name: /Errors only/ }));

    expect(dispatch).toHaveBeenCalledWith({ type: "clear" });
  });

  it("clicking a different chip while one is active swaps the filter (mutually exclusive)", () => {
    const dispatch = vi.fn();
    renderBar(
      { instances: [], requestIds: [], levels: ["ERROR"] },
      dispatch,
    );

    fireEvent.click(screen.getByRole("button", { name: /Instance 7tbsm/ }));

    // No "clear then set" — a single setFilter swap. The reducer
    // discards the prior state outright via the setFilter action.
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setFilter",
      state: { instances: ["7tbsm"], requestIds: [], levels: [] },
    });
  });

  it("a custom filter that doesn't match any preset shows no active chip", () => {
    // Sanity check — only equality with a preset's FilterState turns a
    // chip on, so a hypothetical externally-set state won't accidentally
    // light up the closest chip.
    renderBar({
      instances: ["7tbsm", "a3kx2"],
      requestIds: [],
      levels: ["ERROR"],
    });

    for (const chip of screen.getAllByRole("button")) {
      expect(chip.getAttribute("data-active")).toBe("false");
    }
  });
});
