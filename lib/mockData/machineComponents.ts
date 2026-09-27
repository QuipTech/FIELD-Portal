import type { MachineComponentStatus } from "@/lib/types/machineComponent";

export const powertrainColumnOne: MachineComponentStatus[] = [
  { name: "Engine — C175-16", note: "Serviced 19 Feb · next at 15,000 h", tag: "OK", tone: "ok", icon: "check" },
  { name: "Torque converter", note: "Oil sample flagged 12 Mar · monitor", tag: "Worn", tone: "amber", icon: "alert" },
  { name: "Transmission — 6F/1R", note: "No open findings", tag: "OK", tone: "ok", icon: "check" },
];

export const powertrainColumnTwo: MachineComponentStatus[] = [
  { name: "Final drive — left", note: "Seal replaced 04 Mar", tag: "OK", tone: "ok", icon: "check" },
  { name: "Final drive — right", note: "No open findings", tag: "OK", tone: "ok", icon: "check" },
  { name: "Differential", note: "Overdue by 210 h", tag: "Service due", tone: "amber", icon: "clock" },
];
