import styles from "./page.module.css";

/*
 * /build — the long-form write-up.
 *
 * Home is the project TL;DR; this page is the longer story behind
 * how the prototype was built — design decisions, things tried,
 * things cut. Header treatment matches /system so the two long-form
 * pages read as siblings; body content lands in a follow-up.
 */
export default function BuildPage() {
  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Build</h1>
        <p className={styles.subtitle}>
          How this was built — the longer story.
        </p>
      </header>
    </main>
  );
}
