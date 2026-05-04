"use client";

import { usePathname } from "next/navigation";

import styles from "./shell.module.css";

/*
 * App shell wrapper.
 *
 * The root layout (a server component) builds <Nav />, <Footer />, and
 * the route's page tree, then hands them to this client wrapper as
 * slot props. The client boundary is needed to read the current
 * pathname — the layout itself stays server-rendered.
 *
 * On every route except /demo this renders the original 3-row grid:
 * nav (auto) / children (1fr) / footer (auto), with min-height 100dvh
 * so the footer sits at the bottom of the viewport on short pages and
 * at the bottom of the document on long ones.
 *
 * On /demo it switches to a "scroll-snap reveal": the nav stays pinned
 * at the top, and a single inline scroll container fills the rest of
 * the viewport. That container holds two snap targets — a fold-sized
 * slot for the page (which renders the LogExplorer) and the footer.
 * Default scroll position parks the explorer flush against the fold;
 * scrolling past the bottom of the explorer's internal log list chains
 * up to this container, snaps to the footer, and reveals it.
 *
 * Why a client component for a routing branch:
 * - usePathname requires a client boundary, so the wrapper has to be
 *   "use client".
 * - The slot props (nav, footer, children) are still server-rendered;
 *   the wrapper only chooses how to arrange them. No interactivity or
 *   state lives here, so the client cost is the boundary itself.
 */
export function Shell({
  nav,
  footer,
  children,
}: {
  nav: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDemo = pathname === "/demo";

  if (isDemo) {
    return (
      <div className={`${styles.shell} ${styles.shellDemo}`}>
        {nav}
        {/*
         * Scroll-snap container. Two snap targets — the fold and the
         * footer — sized so the total scroll distance equals exactly
         * --footer-height. Mandatory snap means the page settles in
         * one of the two states and never half-reveals the footer.
         */}
        <div className={styles.demoScroller}>
          <div className={styles.demoFold}>{children}</div>
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {nav}
      {children}
      {footer}
    </div>
  );
}
