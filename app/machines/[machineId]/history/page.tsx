"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { findMachine } from "@/lib/mockData/machines";
import { MachineDetailHeader } from "@/components/machines/machineDetailHeader";
import { MachineTabs } from "@/components/machines/machineTabs";
import { HistoryFilterBar } from "./components/historyFilterBar";
import { HistoryTimeline } from "./components/historyTimeline";
import { AddEntryModal } from "./components/addEntryModal";

interface MachineHistoryPageProps {
  params: { machineId: string };
}

const MachineHistoryPage = ({ params }: MachineHistoryPageProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const machine = findMachine(params.machineId);
  if (!machine) {
    notFound();
  }

  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <MachineDetailHeader
        machine={machine}
        action={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Icon name="plus" />
            Add entry
          </Button>
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

export default MachineHistoryPage;
