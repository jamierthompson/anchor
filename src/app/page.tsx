import { LogList } from "@/components/features/log-list/log-list";
import { mockLogs } from "@/lib/mock-logs";

export default function Home() {
  return (
    <main>
      <LogList lines={mockLogs} />
    </main>
  );
}
