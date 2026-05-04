import styles from "./footer.module.css";

/*
 * Global page footer.
 *
 * Server component — no interactivity, no hooks. Establishes the
 * <footer> contentinfo landmark so screen readers can jump straight
 * to "page footer" the same way they can jump to nav.
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>anchor — a logs explorer prototype</p>
    </footer>
  );
}
