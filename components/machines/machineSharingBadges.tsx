import { Tag } from "@/components/ui/tag";
import type { MachineSharing } from "@/lib/types/machineGroup";
import { MachineGroupBadge } from "./machineGroupBadge";

interface MachineSharingBadgesProps {
  machine: Pick<MachineSharing, "groups" | "isShared" | "owningOrganisationName">;
  // Shown when there's nothing to badge.
  emptyLabel?: string;
}

// "Shared · <owning organisation>" on another organisation's machine, then
// the machine's groups.
export const MachineSharingBadges = ({ machine, emptyLabel = "—" }: MachineSharingBadgesProps) => {
  if (!machine.isShared && machine.groups.length === 0) return <>{emptyLabel}</>;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {machine.isShared && (
        <Tag tone="primary" className="max-w-full">
          <span className="truncate">Shared · {machine.owningOrganisationName}</span>
        </Tag>
      )}
      {machine.groups.map((group) => (
        <MachineGroupBadge key={group.id} name={group.name} colour={group.colour} />
      ))}
    </span>
  );
};
