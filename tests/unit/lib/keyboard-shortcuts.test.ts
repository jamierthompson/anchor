import { describe, expect, it } from "vitest";

import { KEYBOARD_SHORTCUTS } from "@/lib/keyboard-shortcuts";

/**
 * Coverage for the shortcut registry's *invariants* — not its
 * specific contents. Asserting "the sheet has these exact keys" is
 * brittle (it'd break with every binding addition); asserting the
 * shape and the alignment-with-handler invariants is durable.
 *
 * The handler-alignment invariant is enforced by the registry's
 * doc comment, not by tests — testing that requires walking the
 * handler's source which is overkill. These tests just keep the
 * data structure honest so the sheet renders correctly.
 */

describe("KEYBOARD_SHORTCUTS registry", () => {
  it("groups have non-empty titles and at least one shortcut each", () => {
    for (const group of KEYBOARD_SHORTCUTS) {
      expect(group.title).toBeTruthy();
      expect(group.shortcuts.length).toBeGreaterThan(0);
    }
  });

  it("every shortcut has at least one keycap", () => {
    for (const group of KEYBOARD_SHORTCUTS) {
      for (const shortcut of group.shortcuts) {
        expect(shortcut.caps.keys.length).toBeGreaterThan(0);
      }
    }
  });

  it("every shortcut has a non-empty description", () => {
    for (const group of KEYBOARD_SHORTCUTS) {
      for (const shortcut of group.shortcuts) {
        expect(shortcut.description).toBeTruthy();
      }
    }
  });

  it("aliases (when present) each have at least one keycap", () => {
    for (const group of KEYBOARD_SHORTCUTS) {
      for (const shortcut of group.shortcuts) {
        for (const alias of shortcut.caps.aliases ?? []) {
          expect(alias.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("includes the four expected groups (Navigation / Actions / Contexts / Help)", () => {
    // Pinning the section names so the sheet's render and visual
    // grouping stay coherent — adding a fifth group would need a
    // deliberate test update + a layout review.
    expect(KEYBOARD_SHORTCUTS.map((g) => g.title)).toEqual([
      "Navigation",
      "Actions",
      "Contexts",
      "Help",
    ]);
  });

  it("includes the j/↓ alias for Next visible line (alias contract works end-to-end)", () => {
    // One concrete probe of the alias mechanism — if this test
    // breaks, either the binding moved or the alias shape changed.
    // Both warrant a deliberate look.
    const nav = KEYBOARD_SHORTCUTS.find((g) => g.title === "Navigation")!;
    const next = nav.shortcuts.find((s) =>
      s.description.toLowerCase().includes("next visible"),
    );
    expect(next?.caps.keys).toEqual(["J"]);
    expect(next?.caps.aliases?.[0]).toEqual(["↓"]);
  });
});
