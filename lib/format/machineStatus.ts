import type { MachineStatus } from "@/lib/types/machine";
import type { Tone } from "@/components/ui/tone";

interface MachineStatusMeta {
  label: string;
  tone: Tone;
}

const statusMeta: Record<MachineStatus, MachineStatusMeta> = {
  running: { label: "Running", tone: "ok" },
  down: { label: "Down", tone: "danger" },
  serviceDue: { label: "Service due", tone: "amber" },
};

export const getMachineStatusMeta = (status: MachineStatus): MachineStatusMeta => statusMeta[status];
