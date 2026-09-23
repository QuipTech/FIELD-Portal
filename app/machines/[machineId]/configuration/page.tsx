import { notFound } from "next/navigation";
import { findMachine } from "@/lib/mockData/machines";
import { MachineDetailHeader } from "@/components/machines/machineDetailHeader";
import { MachineTabs } from "@/components/machines/machineTabs";
import { SnapshotsPanel } from "./components/snapshotsPanel";
import { DiffPanel } from "./components/diffPanel";

interface MachineConfigurationPageProps {
  params: { machineId: string };
}

const MachineConfigurationPage = ({ params }: MachineConfigurationPageProps) => {
  const machine = findMachine(params.machineId);
  if (!machine) {
    notFound();
  }

  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <MachineDetailHeader machine={machine} />
      <main className="flex flex-1 flex-col overflow-y-auto p-5">
        <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-2xl border border-borderGray bg-white p-5">
          <MachineTabs machineId={machine.id} active="configuration" />
          <div className="flex min-h-0 flex-1 items-stretch gap-4">
            <SnapshotsPanel />
            <DiffPanel />
          </div>
          <p className="mt-3 text-xs text-mutedGray">
            Answers &ldquo;what changed since it last worked&rdquo; — snapshots are taken automatically on
            component swap, service and schedule, and manually by technicians.
          </p>
        </div>
      </main>
    </div>
  );
};

export default MachineConfigurationPage;
