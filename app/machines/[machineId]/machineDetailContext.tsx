"use client";

import { createContext, useContext } from "react";
import type { Machine } from "@/lib/types/machine";
import type { MachineDetailService } from "@/lib/types/machineDetailService";

interface MachineDetailContextValue {
  machineId: string;
  // Null while it loads; tabs start their own loads without waiting.
  machine: Machine | null;
  service: MachineDetailService;
  // Corner confirmations and errors shown by the shell.
  notify: (message: string) => void;
  notifyError: (message: string) => void;
}

const MachineDetailContext = createContext<MachineDetailContextValue | null>(null);

export const MachineDetailProvider = MachineDetailContext.Provider;

// The machine, its data service and notifications, for every machine
// detail tab.
export const useMachineDetail = (): MachineDetailContextValue => {
  const value = useContext(MachineDetailContext);
  if (!value) throw new Error("useMachineDetail must be used inside the machine detail layout.");
  return value;
};
