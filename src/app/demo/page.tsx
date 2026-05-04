import { LogExplorer } from "@/components/features/log-explorer/log-explorer";
import { mockLogs } from "@/lib/mock-logs";

import styles from "./page.module.css";

export default function Demo() {
  return (
    <main id="main-content" className={styles.page}>
      <LogExplorer lines={mockLogs} />
    </main>
  );
}
