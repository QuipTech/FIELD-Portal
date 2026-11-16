import { StatCard } from "@/components/ui/statCard";
import type { McDeviceSummary } from "@/lib/types/machineControl";

export const OverviewStats = ({ summary }: { summary: McDeviceSummary }) => (
  <div className="flex flex-wrap gap-3">
    <StatCard
      label="Machines connected"
      value={String(summary.connected)}
      caption={`of ${summary.connected + summary.notConnected} active machines`}
      icon="broadcast"
      tone="primary"
    />
    <StatCard
      label="Online now"
      value={String(summary.online)}
      caption={summary.online === summary.connected ? "Every connected tablet is live" : "Tablets report every 30 seconds"}
      icon="cloud"
      tone="default"
      variant="plain"
    />
    <StatCard
      label="Waiting to connect"
      value={String(summary.notConnected)}
      caption="Active machines without a tablet yet"
      icon="truck"
      tone={summary.notConnected > 0 ? "amber" : "default"}
      variant="plain"
    />
  </div>
);
