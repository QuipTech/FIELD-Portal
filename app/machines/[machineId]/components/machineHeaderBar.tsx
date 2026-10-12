import { SkeletonBar } from "@/components/ui/skeletonBar";
import { MachineDetailHeader } from "@/components/machines/machineDetailHeader";
import type { Machine } from "@/lib/types/machine";
import type { OperatingStatus } from "@/lib/types/machineFleet";

interface MachineHeaderBarProps {
  machine: Machine | null;
  onStatusChange: (status: OperatingStatus) => Promise<void>;
}

// The header, or its outline while the machine loads.
export const MachineHeaderBar = ({ machine, onStatusChange }: MachineHeaderBarProps) =>
  machine ? (
    <MachineDetailHeader machine={machine} onStatusChange={onStatusChange} />
  ) : (
    <div aria-busy="true" aria-label="Loading machine" className="flex h-14 flex-none items-center gap-3 border-b border-borderGray bg-surface px-4">
      <SkeletonBar className="h-4 w-64" />
      <SkeletonBar className="ml-auto h-9 w-40" />
    </div>
  );
