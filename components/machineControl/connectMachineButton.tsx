"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Icon } from "@/components/icons/icon";
import { ConnectMachineAppDialog } from "@/components/machines/machineApp/connectMachineAppDialog";
import type { ButtonVariant } from "@/components/ui/buttonStyles";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { machineAppPagePath } from "@/lib/types/machineAppConnection";
import type { FleetMachine } from "@/lib/types/machineFleet";
import { ConnectMachinePicker } from "./connectMachinePicker";

interface ConnectMachineButtonProps {
  label?: string;
  variant?: ButtonVariant;
  className?: string;
}

// Pick a machine, show its code, then go to its Machine app tab once paired.
export const ConnectMachineButton = ({ label = "Connect a machine", variant = "primary", className }: ConnectMachineButtonProps) => {
  const router = useRouter();
  const [isPicking, setIsPicking] = useState(false);
  const [machine, setMachine] = useState<FleetMachine | null>(null);

  return (
    <>
      <PermissionButton permission={PERMISSIONS.manageMachineControlDevices} variant={variant} className={className} onClick={() => setIsPicking(true)}>
        <Icon name="plus" />
        {label}
      </PermissionButton>
      {isPicking && (
        <ConnectMachinePicker
          onPick={(picked) => {
            setIsPicking(false);
            setMachine(picked);
          }}
          onClose={() => setIsPicking(false)}
        />
      )}
      {machine && (
        <ConnectMachineAppDialog
          machineId={machine.id}
          machineLabel={machine.label}
          onConnected={() => router.push(machineAppPagePath(machine.id))}
          onClose={() => setMachine(null)}
        />
      )}
    </>
  );
};
