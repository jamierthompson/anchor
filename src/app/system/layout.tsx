import styles from "./layout.module.css";

/*
 * /system route layout — wraps everything inside /system in a
 * theme-scoped element so the toggle's choice never leaks to other
 * routes.
 *
 * The wrapper carries the data-theme attribute (set by the toggle
 * via useSyncExternalStore). data-theme flips color-scheme on this
 * element, which forces the inherited light-dark() values inside
 * the subtree to a specific arm.
 *
 * The inline <script> below runs synchronously after the wrapper
 * div is parsed and before React hydrates, applying the saved
 * preference from localStorage. Without it, a /system reload with
 * a saved theme that disagrees with the OS preference would show a
 * brief flash before the toggle hydrates and reapplies. Wrapped in
 * try/catch because localStorage access throws in some browsers
 * (private mode, disabled storage) — falling back to the OS-preferred
 * theme is the right behavior there.
 */
const initSystemThemeScript = `
  try {
    var saved = localStorage.getItem("anchor-theme");
    if (saved === "light" || saved === "dark") {
      document.getElementById("system-root").dataset.theme = saved;
    }
  } catch {}
`;

export default function SystemLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/*
       * suppressHydrationWarning is required because the inline
       * script below sets data-theme on this element *before* React
       * hydrates. The prop only suppresses warnings on this element —
       * it does NOT disable hydration mismatch detection for the
       * rest of the tree, including children.
       */}
      <div
        id="system-root"
        className={styles.systemRoot}
        suppressHydrationWarning
      >
        {children}
      </div>
      <script dangerouslySetInnerHTML={{ __html: initSystemThemeScript }} />
    </>
  );
}
