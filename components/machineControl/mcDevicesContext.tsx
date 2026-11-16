"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMcDevices } from "@/lib/machineControl/useMcDevices";

type McDevicesValue = ReturnType<typeof useMcDevices>;

const McDevicesContext = createContext<McDevicesValue | null>(null);

// One load of the tablets for the whole module: the banner and every tab read it.
export const McDevicesProvider = ({ children }: { children: ReactNode }) => (
  <McDevicesContext.Provider value={useMcDevices()}>{children}</McDevicesContext.Provider>
);

export const useMcDevicesContext = (): McDevicesValue => {
  const value = useContext(McDevicesContext);
  if (!value) throw new Error("useMcDevicesContext must be used inside the Machine Control layout.");
  return value;
};
