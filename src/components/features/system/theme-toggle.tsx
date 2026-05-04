"use client";

import { useSyncExternalStore } from "react";

import { Chip } from "@/components/ui/chip/chip";

import styles from "./theme-toggle.module.css";

/*
 * Theme toggle — the single client island on /system that lets a
 * visitor flip between light and dark to inspect both palettes
 * against the same surface.
 *
 * Source of truth = the DOM, not React state.
 *
 * The active theme lives on <div id="system-root" data-theme> set up
 * by the route layout. Scoping the attribute to a wrapper (rather
 * than <html>) keeps the toggle's choice from leaking to other
 * routes — / always follows the OS preference. localStorage carries
 * the user's choice across page loads, and the route layout's inline
 * script applies it before React hydrates.
 *
 * useSyncExternalStore is the React-canonical way to subscribe to a
 * non-React source like a DOM dataset attribute. It handles SSR,
 * avoids the "useEffect to mirror external state" anti-pattern, and
 * keeps every toggle in sync with the wrapper's attribute.
 */

const STORAGE_KEY = "anchor-theme";
const WRAPPER_ID = "system-root";

type Theme = "light" | "dark";

/*
 * Module-level listener registry. applyTheme notifies these
 * subscribers whenever it mutates the DOM/storage, which is what
 * triggers useSyncExternalStore to re-read getSnapshot.
 */
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getWrapper(): HTMLElement | null {
  return document.getElementById(WRAPPER_ID);
}

/*
 * Falls back to "light" when the wrapper has no data-theme set,
 * because the absence of the attribute means "follow color-scheme:
 * light dark" — and we treat unset as light for the toggle's
 * default-active state. The route layout's inline script will
 * have set data-theme before hydration whenever a saved value
 * exists, so the unset path is the "no saved preference" case.
 */
function getSnapshot(): Theme {
  const value = getWrapper()?.dataset.theme;
  return value === "dark" ? "dark" : "light";
}

/*
 * The server has no DOM, so we report a stable default. If the
 * client snapshot differs after hydration, useSyncExternalStore
 * triggers a clean re-render without a hydration warning.
 */
function getServerSnapshot(): Theme {
  return "light";
}

function applyTheme(next: Theme) {
  const wrapper = getWrapper();
  if (wrapper) {
    wrapper.dataset.theme = next;
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // localStorage unavailable (private mode, disabled). The theme
    // still applies for this session; we just lose persistence —
    // an acceptable degradation for a non-critical preference.
  }
  listeners.forEach((cb) => cb());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className={styles.group} role="group" aria-label="Theme">
      <Chip
        active={theme === "light"}
        onClick={() => applyTheme("light")}
        aria-label="Switch to light theme"
      >
        Light
      </Chip>
      <Chip
        active={theme === "dark"}
        onClick={() => applyTheme("dark")}
        aria-label="Switch to dark theme"
      >
        Dark
      </Chip>
    </div>
  );
}
