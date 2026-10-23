"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { ActivateMachineDialog, activationActionFor } from "@/components/machines/activateMachineDialog";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import type { Machine } from "@/lib/types/machine";
import type { LifecycleChangeResult } from "@/lib/types/machineLifecycle";

interface MachineActivationBannerProps {
  machine: Machine;
  onActivated: (result: LifecycleChangeResult) => void;
}

const STATE_MESSAGES = {
  registered: "This machine is registered but not active yet.",
  archived: "This machine is archived.",
  sold: "This machine was sold to another organisation.",
} as const;

// Above the tabs of a machine that isn't active, which only shows its
// identity and summary: why, and (with machine.lifecycle) the way out.
export const MachineActivationBanner = ({ machine, onActivated }: MachineActivationBannerProps) => {
  const [isConfirming, setIsConfirming] = useState(false);
  if (machine.lifecycleState === "active") return null;
  const action = activationActionFor(machine.lifecycleState);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amberBorder bg-amberTint px-4 py-3">
      <Icon name="alert" className="h-4 w-4 flex-none text-amber" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-ink">{STATE_MESSAGES[machine.lifecycleState]}</span>
        <span className="text-xs text-bodyGray">
          {action
            ? "Activate it to open its history, components, photos, AI and support, here and in the mobile app."
            : "Its history now belongs to the new owner."}
        </span>
      </div>
      {action && (
        <PermissionButton
          permission={PERMISSIONS.manageMachineLifecycle}
          variant="primary"
          onClick={() => setIsConfirming(true)}
        >
          {action === "reactivate" ? "Reactivate machine" : "Activate machine"}
        </PermissionButton>
      )}
      {isConfirming && (
        <ActivateMachineDialog
          machineId={machine.id}
          machineLabel={machine.assetId}
          lifecycleState={machine.lifecycleState}
          onActivated={onActivated}
          onClose={() => setIsConfirming(false)}
        />
      )}
    </div>
  );
};
