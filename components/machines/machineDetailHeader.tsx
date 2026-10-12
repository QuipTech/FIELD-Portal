"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { buildAssistantHref } from "@/lib/machineDetail/assistantHref";
import type { Machine } from "@/lib/types/machine";
import type { OperatingStatus } from "@/lib/types/machineFleet";
import { MachineStatusSelect } from "./machineStatusSelect";

interface MachineDetailHeaderProps {
  machine: Machine;
  onStatusChange: (status: OperatingStatus) => Promise<void>;
}

export const MachineDetailHeader = ({ machine, onStatusChange }: MachineDetailHeaderProps) => {
  const router = useRouter();

  return (
    <div className="flex h-14 flex-none items-center gap-2.5 border-b border-borderGray bg-surface px-4">
      <Link href="/machines" className="text-[15px] text-bodyGray hover:text-ink">
        Machines
      </Link>
      <Icon name="chevr" className="stroke-mutedGray" />
      <span className="truncate text-[15px] font-medium text-ink">
        {machine.manufacturer} {machine.model} · {machine.assetId}
      </span>
      <div className="ml-auto flex flex-none items-center gap-2.5">
        <MachineStatusSelect status={machine.status} onChange={onStatusChange} />
        <PermissionButton
          permission={PERMISSIONS.useAiAssistant}
          variant="primary"
          onClick={() => router.push(buildAssistantHref(machine.id))}
        >
          <Icon name="spark" />
          Ask AI about this
        </PermissionButton>
      </div>
    </div>
  );
};
