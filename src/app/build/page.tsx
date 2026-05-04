import { PageHeader } from "@/components/ui/page-header/page-header";

import styles from "./page.module.css";

/*
 * /build — the long-form write-up.
 *
 * Home is the project TL;DR; this page is the longer story behind
 * how the prototype was built — design decisions, things tried,
 * things cut. Header treatment is shared with /system via the
 * PageHeader primitive; body content lands in a follow-up.
 */
export default function BuildPage() {
  return (
    <main id="main-content" className={styles.page}>
      <PageHeader title="Build" subtitle="How this was built — the longer story." />
    </main>
  );
}
