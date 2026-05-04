import styles from "./footer.module.css";

/*
 * The repo URL is hard-coded — it's a public, stable identity for
 * this project. If the repo ever moves, this is the only place that
 * needs to know.
 */
const REPO_URL = "https://github.com/jamierthompson/anchor";

/*
 * Inline GitHub mark SVG. Lucide v1 (the version pinned in this
 * project) dropped brand icons, so a tiny inline path is the
 * lightest fix — no dependency upgrade, no extra dist bytes for
 * an icon used in exactly one place. `currentColor` lets the link
 * style drive the fill, matching the surrounding chrome on hover.
 */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-1.92c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.93 10.93 0 0 1 5.74 0c2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.66.79.55C20.71 21.39 24 17.07 24 12 24 5.65 18.85.5 12 .5z" />
    </svg>
  );
}

/*
 * Global page footer.
 *
 * Server component — no interactivity, no hooks. Establishes the
 * <footer> contentinfo landmark so screen readers can jump straight
 * to "page footer" the same way they can jump to nav.
 *
 * The GitHub link uses target="_blank" + rel="noopener noreferrer".
 * - target="_blank" opens in a new tab so the visitor doesn't lose
 *   their place in the app.
 * - rel="noopener" prevents the new tab's window.opener from
 *   reaching back into our context (a long-standing security
 *   guideline for any external _blank link).
 * - rel="noreferrer" omits the Referer header so the destination
 *   doesn't see which route the click came from.
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>anchor — a logs explorer prototype</p>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View source on GitHub (opens in new tab)"
        className={styles.iconLink}
      >
        <GithubIcon className={styles.icon} />
      </a>
    </footer>
  );
}
