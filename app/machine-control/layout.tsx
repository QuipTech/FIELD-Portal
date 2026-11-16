"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { MachineControlGate } from "@/components/machineControl/machineControlGate";
import { MachineControlHeader } from "@/components/machineControl/machineControlHeader";
import { MachineControlTabs } from "@/components/machineControl/machineControlTabs";
import { McDevicesProvider, useMcDevicesContext } from "@/components/machineControl/mcDevicesContext";
import { summariseDevices } from "@/lib/types/machineControl";

const HeaderWithCounts = () => {
  const { data } = useMcDevicesContext();
  const summary = data ? summariseDevices(data) : null;
  return <MachineControlHeader onlineCount={summary?.online ?? null} connectedCount={summary?.connected ?? null} />;
};

// Machine Control: banner and tabs over every section, behind the
// organisation's switch and the mc.view permission.
const MachineControlLayout = ({ children }: { children: ReactNode }) => (
  <AppShell topBar={<TopBar />}>
    <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
      <MachineControlGate>
        <McDevicesProvider>
          <HeaderWithCounts />
          <MachineControlTabs />
          {children}
        </McDevicesProvider>
      </MachineControlGate>
    </main>
  </AppShell>
);

export default MachineControlLayout;
