import { notFound } from "next/navigation";
import { findMachine } from "@/lib/mockData/machines";
import { powertrainColumnOne, powertrainColumnTwo } from "@/lib/mockData/machineComponents";
import { MachineDetailHeader } from "@/components/machines/machineDetailHeader";
import { MachineTabs } from "@/components/machines/machineTabs";
import { SystemsSideNav } from "./components/systemsSideNav";
import { MachinePhotoGallery } from "./components/machinePhotoGallery";
import { MachineSpecList } from "./components/machineSpecList";
import { ComponentStatusCard } from "./components/componentStatusCard";

interface MachineDetailPageProps {
  params: { machineId: string };
}

const MachineDetailPage = ({ params }: MachineDetailPageProps) => {
  const machine = findMachine(params.machineId);
  if (!machine) {
    notFound();
  }

  return (
    <div className="flex h-screen flex-col bg-surfaceGray">
      <MachineDetailHeader machine={machine} />
      <div className="flex min-h-0 flex-1">
        <SystemsSideNav />
        <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="flex gap-4">
            <MachinePhotoGallery />
            <MachineSpecList machine={machine} />
          </div>
          <MachineTabs machineId={machine.id} active="components" />
          <div className="flex flex-1 gap-3.5">
            <div className="flex flex-1 flex-col gap-3.5">
              {powertrainColumnOne.map((component) => (
                <ComponentStatusCard key={component.name} {...component} />
              ))}
            </div>
            <div className="flex flex-1 flex-col gap-3.5">
              {powertrainColumnTwo.map((component) => (
                <ComponentStatusCard key={component.name} {...component} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MachineDetailPage;
