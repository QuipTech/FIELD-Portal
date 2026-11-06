"use client";

import { EmptyState } from "@/components/ui/emptyState";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { formatDayMonth } from "@/lib/format/elapsedTimeLabel";
import { listGroupActivityRequest } from "@/lib/api/adminMachineGroupsApi";
import type { GroupActivity } from "@/lib/types/machineGroup";

const LEVEL_LABELS: Record<string, string> = { view: "View", contribute: "Contribute" };

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

const targetOf = (metadata: Record<string, unknown>): string => {
  const target = metadata.target as { name?: string; type?: string } | undefined;
  return target?.name ?? (target?.type === "user" ? "a user" : "an organisation");
};

// One audit entry as a sentence (backend machineSharing audit metadata).
const describe = (entry: GroupActivity): string => {
  const metadata = entry.metadata ?? {};
  const level = LEVEL_LABELS[textOf(metadata.accessLevel)] ?? "";
  switch (metadata.change) {
    case "machines_added": {
      const count = Array.isArray(metadata.machines) ? metadata.machines.length : 0;
      return `Added ${count} ${count === 1 ? "machine" : "machines"}`;
    }
    case "machine_removed":
      return `Removed ${textOf((metadata.machine as { label?: string } | undefined)?.label) || "a machine"}`;
    case "assignment_granted":
      return `Shared with ${targetOf(metadata)} (${level})`;
    case "assignment_level_changed":
      return `Changed ${targetOf(metadata)} to ${level}`;
    case "assignment_revoked":
      return `Revoked access${metadata.reason ? `: ${textOf(metadata.reason)}` : ""}`;
    default:
      if (entry.action === "create") return "Created the group";
      if (entry.action === "delete") return "Deleted the group";
      return "Edited the group";
  }
};

// The group's audit trail, newest first.
export const GroupActivityTab = ({ groupId }: { groupId: string }) => {
  const activity = useApiResource(
    (token) => listGroupActivityRequest(token, groupId),
    [groupId],
    "Couldn't load the activity.",
  );

  if (activity.error) return <LoadErrorState message={activity.error} onRetry={activity.reload} />;
  if (!activity.data) return <SkeletonBar className="h-4 w-1/2" />;
  if (activity.data.length === 0) return <EmptyState icon="history" title="No activity yet" />;
  return (
    <ul className="flex flex-col divide-y divide-borderGray rounded-xl border border-borderGray">
      {activity.data.map((entry) => (
        <li key={entry.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="min-w-0 flex-1 text-ink">{describe(entry)}</span>
          <span className="flex-none text-xs text-mutedGray">
            {entry.actorName ?? "—"} · {formatDayMonth(new Date(entry.createdAt))}
          </span>
        </li>
      ))}
    </ul>
  );
};
