import type { MachineStatus } from "@/lib/types/machine";
import type { OperatingStatus } from "@/lib/types/machineFleet";
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

// The API's operating status ("service_due") in the portal's shape.
export const toMachineStatus = (status: OperatingStatus | string): MachineStatus =>
  status === "down" ? "down" : status === "service_due" ? "serviceDue" : "running";

export const OPERATING_STATUS_OPTIONS: { value: OperatingStatus; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "down", label: "Down" },
  { value: "service_due", label: "Service due" },
];
