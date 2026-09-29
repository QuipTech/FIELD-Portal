"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { LinkButton } from "@/components/ui/linkButton";
import { PermissionButton } from "@/components/auth/permissionButton";
import { MachineDetailHeader } from "@/components/machines/machineDetailHeader";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import type { Machine, MachineStatus } from "@/lib/types/machine";
import type { MachineSummary } from "@/lib/types/machineHistory";
import { useLiveMachineHistory } from "../useLiveMachineHistory";
import { LiveHistoryTimeline } from "./liveHistoryTimeline";
import { LiveAddEntryModal } from "./liveAddEntryModal";

const toHeaderStatus = (status: string): MachineStatus =>
  status === "down" ? "down" : status === "service_due" ? "serviceDue" : "running";

// The shared header expects the portal's Machine shape; the fleet number
// (or serial) is what people call a machine by.
const toHeaderMachine = (machine: MachineSummary): Machine => ({
  id: machine.fleetNumber ?? machine.serialNumber,
  model: `${machine.manufacturer} ${machine.model}`,
  site: "",
  status: toHeaderStatus(machine.status),
  hours: 0,
});

// History for a machine registered in the database (its UUID in the URL).
// The other machine tabs are still sample-only, so they aren't linked here.
export const LiveMachineHistory = ({ machineId }: { machineId: string }) => {
  const { machine, entries, isLoading, loadError, createEntry, addPhoto, deletePhoto } = useLiveMachineHistory(machineId);
  const [isAdding, setIsAdding] = useState(false);

  if (isLoading || loadError || !machine) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-surfaceGray text-sm text-mutedGray">
        {isLoading ? (
          <span className="flex items-center gap-2"><LoadingSpinner /> Loading history…</span>
        ) : (
          <>
            <span className="text-danger">{loadError ?? "Machine not found."}</span>
            <LinkButton href="/machines" variant="primary">Back to machines</LinkButton>
          </>
        )}
      </div>
    );
  }

  const headerMachine = toHeaderMachine(machine);
  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <MachineDetailHeader
        machine={headerMachine}
        action={
          <PermissionButton permission={PERMISSIONS.addHistoryEntry} variant="primary" onClick={() => setIsAdding(true)}>
            <Icon name="plus" />
            Add entry
          </PermissionButton>
        }
      />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <LiveHistoryTimeline machineId={machineId} entries={entries} onPhotoAdded={addPhoto} onPhotoDeleted={deletePhoto} />
      </main>
      {isAdding && (
        <LiveAddEntryModal machineLabel={headerMachine.id} onCreate={createEntry} onClose={() => setIsAdding(false)} />
      )}
    </div>
  );
};
