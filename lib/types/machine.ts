export type MachineStatus = "running" | "down" | "serviceDue";

export interface Machine {
  id: string;
  model: string;
  site: string;
  status: MachineStatus;
  hours: number;
}
