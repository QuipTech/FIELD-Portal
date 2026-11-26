"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectMachineAppDialog } from "@/components/machines/machineApp/connectMachineAppDialog";
import { machineAppPagePath } from "@/lib/types/machineAppConnection";
import type { FleetMachine } from "@/lib/types/machineFleet";

// A row's Add tablet button: a connected machine opens its Machine app tab;
// otherwise the Add tablet dialog opens, rendered by the table (outside the row's
// link, so clicks inside it don't open the machine).
export const useConnectMachineApp = () => {
  const router = useRouter();
  const [connecting, setConnecting] = useState<FleetMachine | null>(null);

  const open = (machine: FleetMachine) =>
    machine.appConnected ? router.push(machineAppPagePath(machine.id)) : setConnecting(machine);

  const dialog = connecting && (
    <ConnectMachineAppDialog
      machineId={connecting.id}
      machineLabel={connecting.label}
      onConnected={() => router.push(machineAppPagePath(connecting.id))}
      onClose={() => setConnecting(null)}
    />
  );

  return { open, dialog };
};
