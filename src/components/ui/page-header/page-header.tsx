import styles from "./page-header.module.css";

/*
 * PageHeader — title + optional subtitle pair shared by long-form
 * pages (/system, /build).
 *
 * Renders a real <header> landmark so the page outline reads as
 * "main → header → content" without each page having to remember
 * to wrap its title in <header> manually. The h1 sits inside the
 * header so the page's announced heading and the landmark line up.
 *
 * Server component — no interactivity, no hooks. Title / subtitle
 * are plain strings; if a future page needs richer subtitle markup
 * (links, code), the prop can widen to ReactNode then.
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
    </header>
  );
}
