"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import styles from "./theme-toggle.module.css";

/*
 * Theme toggle — the global control that flips the app between
 * light and dark. Lives in the top nav (top-right corner) so it's
 * reachable from every route, not only /system.
 *
 * Source of truth = the DOM, not React state.
 *
 * The active theme lives on <html data-theme>, set up by the root
 * layout's beforeInteractive init script. Targeting <html> means
 * a visitor's pick on /system follows them across the entire app.
 * localStorage carries the choice across page loads.
 *
 * useSyncExternalStore is the React-canonical way to subscribe to a
 * non-React source like a DOM dataset attribute. It handles SSR,
 * avoids the "useEffect to mirror external state" anti-pattern, and
 * keeps any future toggle instance in sync with <html>'s attribute.
 */

const STORAGE_KEY = "anchor-theme";

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

/*
 * Falls back to "light" when <html> has no data-theme set, because
 * the absence of the attribute means "follow color-scheme: light
 * dark" — and we treat unset as light for the toggle's default-active
 * state. The root layout's init script will have set data-theme
 * before hydration whenever a saved value exists, so the unset path
 * is the "no saved preference" case.
 */
function getSnapshot(): Theme {
  const value = document.documentElement.dataset.theme;
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
  document.documentElement.dataset.theme = next;
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
      <button
        type="button"
        className={styles.button}
        aria-label="Switch to light theme"
        aria-pressed={theme === "light"}
        onClick={() => applyTheme("light")}
      >
        <Sun aria-hidden="true" className={styles.icon} />
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label="Switch to dark theme"
        aria-pressed={theme === "dark"}
        onClick={() => applyTheme("dark")}
      >
        <Moon aria-hidden="true" className={styles.icon} />
      </button>
    </div>
  );
}
