import { type ReactNode } from "react";

import { PageHeader } from "@/components/ui/page-header/page-header";

import styles from "./page-shell.module.css";

/*
 * PageShell — full page chrome for long-form pages with a left-rail
 * TOC and a content column. /system uses it for the design-token
 * reference; /build uses it for the project write-up.
 *
 * The shell owns:
 *   - the <main id="main-content"> landmark (the skip-link target)
 *   - the centered max-width container and page-edge padding
 *   - the PageHeader with title + optional subtitle
 *   - the responsive 2-column grid: TOC | content on tablet+,
 *     stacked on mobile
 *
 * The consumer supplies the sidebar (TOC) via the `sidebar` prop and
 * the right-column content via children. The shell stays opinionated
 * about layout but unopinionated about what fills the columns — TOC,
 * static placeholder, or anything else is fair game.
 *
 * Server component by default. Sidebar contents may be a client
 * component (e.g. Toc with IntersectionObserver) without affecting
 * the shell's server-rendered status.
 */
interface PageShellProps {
  title: string;
  subtitle?: string;
  /**
   * Renders into the left rail on tablet+, above the content on
   * mobile. Typically a TOC component.
   */
  sidebar: ReactNode;
  /**
   * Right-column content. The shell wraps it in a flex column with
   * --space-16 gaps so consecutive top-level sections breathe.
   */
  children: ReactNode;
}

export function PageShell({
  title,
  subtitle,
  sidebar,
  children,
}: PageShellProps) {
  return (
    <main id="main-content" className={styles.page}>
      <PageHeader title={title} subtitle={subtitle} />
      <div className={styles.layout}>
        <aside className={styles.sidebar}>{sidebar}</aside>
        <div className={styles.content}>{children}</div>
      </div>
    </main>
  );
}
