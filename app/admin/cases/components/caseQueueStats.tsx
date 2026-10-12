import { StatCard } from "@/components/ui/statCard";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import type { AdminCaseStats } from "@/lib/types/adminSupportCase";

export const CaseQueueStats = ({ stats }: { stats: AdminCaseStats | null }) => {
  if (!stats) {
    return (
      <div className="flex gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonBar key={index} className="h-[92px] flex-1 rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <StatCard variant="plain" label="Unassigned" value={String(stats.unassigned)} tone="default" />
      <StatCard variant="plain" label="Open" value={String(stats.open)} tone="default" />
      <StatCard variant="plain" label="Waiting on customer" value={String(stats.waitingOnCustomer)} tone="default" />
      <StatCard
        variant="plain"
        label="SLA breached"
        value={String(stats.slaBreached)}
        tone={stats.slaBreached > 0 ? "danger" : "default"}
      />
    </div>
  );
};
