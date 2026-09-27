"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import type { Machine } from "@/lib/types/machine";
import { MachineDetailHeader } from "@/components/machines/machineDetailHeader";
import { MachineTabs } from "@/components/machines/machineTabs";
import { HistoryFilterBar } from "./historyFilterBar";
import { HistoryTimeline } from "./historyTimeline";
import { AddEntryModal } from "./addEntryModal";

// The demo history for the sample machines in lib/mockData (HT-2201 …).
// Real machines use LiveMachineHistory.
export const SampleMachineHistory = ({ machine }: { machine: Machine }) => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <MachineDetailHeader
        machine={machine}
        action={
          <PermissionButton
            permission={PERMISSIONS.addHistoryEntry}
            variant="primary"
            onClick={() => setModalOpen(true)}
          >
            <Icon name="plus" />
            Add entry
          </PermissionButton>
        }
      />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <MachineTabs machineId={machine.id} active="history" />
        <HistoryFilterBar />
        <HistoryTimeline />
      </main>
      {modalOpen ? (
        <AddEntryModal machineId={machine.id} hours={machine.hours} onClose={() => setModalOpen(false)} />
      ) : null}
    </div>
  );
};
