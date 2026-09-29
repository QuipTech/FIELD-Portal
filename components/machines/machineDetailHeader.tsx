import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { getMachineStatusMeta } from "@/lib/format/machineStatus";
import type { Machine } from "@/lib/types/machine";

interface MachineDetailHeaderProps {
  machine: Machine;
  action?: ReactNode;
}

export const MachineDetailHeader = ({ machine, action }: MachineDetailHeaderProps) => {
  const status = getMachineStatusMeta(machine.status);

  return (
    <div className="flex h-14 flex-none items-center gap-2.5 border-b border-borderGray bg-surface px-4">
      <Link href="/machines" className="text-[15px] text-bodyGray">
        Machines
      </Link>
      <Icon name="chevr" className="stroke-mutedGray" />
      <span className="text-[15px] font-medium text-ink">
        {machine.model} · {machine.id}
      </span>
      <div className="ml-auto flex items-center gap-2.5">
        {action ?? (
          <>
            <Tag tone={status.tone}>
              {machine.status === "down" ? <Icon name="alert" className="h-3.5 w-3.5" /> : null}
              {status.label}
            </Tag>
            <PermissionButton permission={PERMISSIONS.useAiAssistant} variant="primary">
              <Icon name="spark" />
              Ask AI about this
            </PermissionButton>
          </>
        )}
      </div>
    </div>
  );
};
