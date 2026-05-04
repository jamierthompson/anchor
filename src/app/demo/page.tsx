import { LogExplorer } from "@/components/features/log-explorer/log-explorer";
import { mockLogs } from "@/lib/mock-logs";

export default function Demo() {
  return (
    <main id="main-content">
      <LogExplorer lines={mockLogs} />
    </main>
  );
}
