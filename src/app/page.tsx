import { LogExplorer } from "@/components/features/log-explorer/log-explorer";
import { mockLogs } from "@/lib/mock-logs";

export default function Home() {
  return (
    <main>
      <LogExplorer lines={mockLogs} />
    </main>
  );
}
