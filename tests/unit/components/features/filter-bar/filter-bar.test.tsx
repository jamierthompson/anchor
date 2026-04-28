import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterBar } from "@/components/features/filter-bar/filter-bar";
import {
  initialFilterState,
  type FilterAction,
  type FilterState,
} from "@/lib/filter-state";

/**
 * Coverage focus: the cmd/ctrl + click chip → clear-facet shortcut
 * (spec §7) and the propagation guard that keeps a modifier-click on
 * the × button from triggering both paths at once.
 *
 * General chip rendering is exercised indirectly through the wider
 * end-to-end paths; these tests target the modifier behavior because
 * it's the new surface area in this commit.
 */

const stateWithFilters = (overrides: Partial<FilterState>): FilterState => ({
  ...initialFilterState,
  ...overrides,
});

const renderBar = (
  state: FilterState,
  dispatch: (action: FilterAction) => void,
) => render(<FilterBar state={state} dispatch={dispatch} />);

describe("FilterBar — cmd/ctrl + click chip clears the facet", () => {
  it("cmd + click on a chip body dispatches clearFacet for that facet", () => {
    const dispatch = vi.fn();
    renderBar(
      stateWithFilters({ instances: ["7tbsm", "a3kx2"] }),
      dispatch,
    );

    // Two instance chips are rendered; the chip body owns the modifier
    // handler. Clicking with metaKey triggers a single clearFacet.
    fireEvent.click(screen.getByText("instance: 7tbsm"), {
      metaKey: true,
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "clearFacet",
      facet: "instances",
    });
  });

  it("ctrl + click on a chip body also clears the facet (Windows / Linux modifier)", () => {
    const dispatch = vi.fn();
    renderBar(stateWithFilters({ levels: ["WARN", "ERROR"] }), dispatch);

    fireEvent.click(screen.getByText("level: error"), { ctrlKey: true });

    expect(dispatch).toHaveBeenCalledWith({
      type: "clearFacet",
      facet: "levels",
    });
  });

  it("plain click on a chip body does not dispatch anything", () => {
    const dispatch = vi.fn();
    renderBar(stateWithFilters({ instances: ["7tbsm"] }), dispatch);

    fireEvent.click(screen.getByText("instance: 7tbsm"));

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("clicking the × button removes only that single value (no facet clear)", () => {
    const dispatch = vi.fn();
    renderBar(
      stateWithFilters({ instances: ["7tbsm", "a3kx2"] }),
      dispatch,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove filter: instance: 7tbsm",
      }),
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "toggleInstance",
      value: "7tbsm",
    });
  });

  it("cmd + click directly on the × button removes only that value — propagation is stopped", () => {
    // Without stopPropagation, the chip's modifier handler would also
    // fire and we'd dispatch both toggleInstance and clearFacet.
    const dispatch = vi.fn();
    renderBar(
      stateWithFilters({ instances: ["7tbsm", "a3kx2"] }),
      dispatch,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove filter: instance: 7tbsm",
      }),
      { metaKey: true },
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "toggleInstance",
      value: "7tbsm",
    });
  });
});
