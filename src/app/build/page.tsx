import { PageShell } from "@/components/ui/page-shell/page-shell";

import styles from "./page.module.css";

/*
 * /build — the long-form write-up.
 *
 * Page chrome (max-width container, header, 2-column grid) comes
 * from PageShell, the same primitive /system uses — so any layout
 * change to either page is one-edit. The sidebar and section
 * content here are placeholders so the layout can be verified
 * against /system before real content lands.
 */

interface PlaceholderLink {
  id: string;
  label: string;
}

const PLACEHOLDER_LINKS: readonly PlaceholderLink[] = [
  { id: "section-intro", label: "Intro" },
  { id: "section-process", label: "Process" },
  { id: "section-lessons", label: "Lessons" },
];

export default function BuildPage() {
  return (
    <PageShell
      title="Build"
      subtitle="How this was built — the longer story."
      sidebar={
        <nav aria-label="Table of contents" className={styles.toc}>
          <h2 className={styles.tocHeading}>On this page</h2>
          <ul className={styles.tocList}>
            {PLACEHOLDER_LINKS.map(({ id, label }) => (
              <li key={id}>
                <a href={`#${id}`} className={styles.tocLink}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      }
    >
      <section id="section-intro" aria-labelledby="heading-intro">
        <h2 id="heading-intro" className={styles.sectionHeading}>
          Intro
        </h2>
        <p className={styles.prose}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec
          a diam lectus. Sed sit amet ipsum mauris. Maecenas congue
          ligula ac quam viverra nec consectetur ante hendrerit. Donec et
          mollis dolor. Praesent et diam eget libero egestas mattis sit
          amet vitae augue.
        </p>
        <p className={styles.prose}>
          Nam tincidunt congue enim, ut porta lorem lacinia consectetur.
          Donec ut libero sed arcu vehicula ultricies a non tortor. Lorem
          ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
      </section>

      <section id="section-process" aria-labelledby="heading-process">
        <h2 id="heading-process" className={styles.sectionHeading}>
          Process
        </h2>
        <p className={styles.prose}>
          Aenean ut gravida lorem. Ut turpis felis, pulvinar a semper
          sed, adipiscing id dolor. Pellentesque auctor nisi id magna
          consequat sagittis. Curabitur dapibus enim sit amet elit
          pharetra tincidunt feugiat nisl imperdiet.
        </p>
        <p className={styles.prose}>
          Ut convallis libero in urna ultrices accumsan. Donec sed odio
          eros. Donec viverra mi quis quam pulvinar at malesuada arcu
          rhoncus. Cum sociis natoque penatibus et magnis dis parturient
          montes, nascetur ridiculus mus.
        </p>
      </section>

      <section id="section-lessons" aria-labelledby="heading-lessons">
        <h2 id="heading-lessons" className={styles.sectionHeading}>
          Lessons
        </h2>
        <p className={styles.prose}>
          In rutrum accumsan ultricies. Mauris vitae nisi at sem facilisis
          semper ac in est. Vivamus fermentum semper porta. Nunc diam
          velit, adipiscing ut tristique vitae, sagittis vel odio. Maecenas
          convallis ullamcorper ultricies.
        </p>
      </section>
    </PageShell>
  );
}
