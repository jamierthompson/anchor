"use client";

import { useEffect, useState } from "react";

import styles from "./toc.module.css";

/*
 * Table of contents for /system.
 *
 * Sits in a left column on desktop (sticky) and stacks above the
 * first content section on mobile (static). Each entry is a hash
 * link to its section; the active entry is driven by scroll
 * position math (see updateActive below).
 *
 * The section IDs here mirror the ones rendered by /system page.tsx;
 * they're declared as a const so the TOC and the page can't drift
 * apart silently — adding a new section requires updating this list.
 *
 * Why scroll math, not IntersectionObserver: the obvious approach
 * is an observer with a thin "active band" rootMargin. That breaks
 * in two real cases on this page:
 *   - Short sections (e.g. Radius is just a 2-row table) scroll
 *     through the band fast enough that no entry events fire while
 *     it's the dominant on-screen section.
 *   - The last section (Media) never reaches the active band when
 *     the page ends before it can scroll into the top portion of
 *     the viewport.
 * Walking sections by getBoundingClientRect on each scroll event
 * is cheap and gives a deterministic answer for every scroll
 * position, including page bottom.
 */

type Item = {
  id: string;
  label: string;
};

const ITEMS: Item[] = [
  { id: "section-color", label: "Color" },
  { id: "section-typography", label: "Typography" },
  { id: "section-spacing", label: "Spacing" },
  { id: "section-radius", label: "Radius" },
  { id: "section-shadow", label: "Shadow" },
  { id: "section-motion", label: "Motion" },
  { id: "section-z-index", label: "Z-index" },
  { id: "section-media", label: "Media" },
];

/*
 * Threshold: how far from the viewport top a section must reach
 * before it counts as "active". Sits just below the fixed theme-
 * toggle band so a section flips to active once its H2 has
 * scrolled into the visible area below the band.
 */
const ACTIVE_THRESHOLD_PX = 100;

export function Toc() {
  const [activeId, setActiveId] = useState<string>(ITEMS[0].id);

  useEffect(() => {
    const sections = ITEMS.map((item) =>
      document.getElementById(item.id),
    ).filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    function updateActive() {
      // Pick the lowest-positioned section whose top has crossed
      // ACTIVE_THRESHOLD_PX from the viewport top. Walking in DOM
      // order and remembering the last match gives that result in
      // a single pass.
      let activeIndex = 0;
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= ACTIVE_THRESHOLD_PX) {
          activeIndex = i;
        }
      }

      // Edge case: at the very bottom of the page, the last
      // section's top might still be above the threshold (so the
      // walk above already picked it), but if the user has scrolled
      // such that the last section is fully visible, force it
      // active so the TOC reflects "you've reached the end."
      const lastSection = sections[sections.length - 1];
      if (lastSection.getBoundingClientRect().bottom <= window.innerHeight) {
        activeIndex = sections.length - 1;
      }

      setActiveId(sections[activeIndex].id);
    }

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, []);

  return (
    <nav aria-label="Table of contents" className={styles.toc}>
      <h2 className={styles.heading}>On this page</h2>
      <ul className={styles.list}>
        {ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={styles.link}
              data-active={activeId === item.id ? "true" : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
