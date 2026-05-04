"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/features/system/theme-toggle";

import styles from "./nav.module.css";

/*
 * Global top navigation.
 *
 * Three landmark concerns are stacked into one element:
 *   - <header> establishes the banner landmark for the whole site
 *   - <nav aria-label="Primary"> establishes the primary navigation
 *     landmark inside the banner
 *   - The brand wordmark is a sibling of <nav> rather than inside it,
 *     so it isn't double-announced as a nav item by screen readers
 *
 * Active state uses aria-current="page" — the canonical, assistive-tech-
 * surfaced way to mark the current location. Visual styling hangs off
 * that same attribute via [aria-current="page"], so the visual state
 * and the announced state are guaranteed to match.
 *
 * Client component so usePathname() can drive aria-current. Everything
 * else (Link, list rendering) is pure markup.
 */

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Demo" },
  { href: "/system", label: "System" },
  { href: "/build", label: "Build" },
] as const;

/*
 * "/" is active only on an exact match — startsWith would mark it
 * active for every route. Other entries match either an exact path
 * or any nested route below them, so a future /demo/foo page would
 * still highlight "Demo".
 */
function isActiveLink(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="Anchor — home">
        anchor
      </Link>
      <div className={styles.actions}>
        <nav aria-label="Primary">
          <ul className={styles.list} role="list">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isActiveLink(href, pathname);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={styles.link}
                    aria-current={active ? "page" : undefined}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
