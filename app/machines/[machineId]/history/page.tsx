import { findMachine } from "@/lib/mockData/machines";
import { SampleMachineHistory } from "./components/sampleMachineHistory";
import { LiveMachineHistory } from "./components/liveMachineHistory";

interface MachineHistoryPageProps {
  params: { machineId: string };
}

// Sample machines (lib/mockData, e.g. HT-2201) keep their demo history
// until a machines API exists; any other id is loaded as a real machine.
const MachineHistoryPage = ({ params }: MachineHistoryPageProps) => {
  const sampleMachine = findMachine(params.machineId);
  return sampleMachine ? (
    <SampleMachineHistory machine={sampleMachine} />
  ) : (
    <LiveMachineHistory machineId={params.machineId} />
  );
};

export default MachineHistoryPage;
