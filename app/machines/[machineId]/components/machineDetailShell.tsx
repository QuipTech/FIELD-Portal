"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LinkButton } from "@/components/ui/linkButton";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { ErrorToast } from "@/components/ui/errorToast";
import { SavedToast } from "@/components/ui/savedToast";
import { MachineTabs, type MachineTab } from "@/components/machines/machineTabs";
import { machineDetailService as service } from "@/lib/api/machineDetail/machineDetailService";
import { useCachedResource } from "@/lib/machineDetail/useCachedResource";
import { machineCacheKeys } from "@/lib/machineDetail/machineDetailCacheKeys";
import type { OperatingStatus } from "@/lib/types/machineFleet";
import { MachineDetailProvider } from "../machineDetailContext";
import { useOfflineHistorySync } from "../useOfflineHistorySync";
import { prefetchMachineDetail } from "../prefetchMachineDetail";
import { MachineHeaderBar } from "./machineHeaderBar";
import { MachinePhotoGallery } from "./machinePhotoGallery";
import { MachineSpecList } from "./machineSpecList";
import { SystemsSideNav } from "./systemsSideNav";

const toActiveTab = (pathname: string, machineId: string): MachineTab => {
  const section = pathname.slice(`/machines/${machineId}`.length).split("/")[1];
  return section === "history" || section === "config-history" ? section : "components";
};

// Everything above the tab content, shared by every machine detail tab:
// breadcrumb and actions, photo gallery, info card and tabs. The tab
// renders at once and loads in parallel with the machine itself.
export const MachineDetailShell = ({ machineId, children }: { machineId: string; children: ReactNode }) => {
  const machine = useCachedResource(machineCacheKeys.machine(machineId), () => service.getMachine(machineId), "Couldn't load this machine.");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeTab = toActiveTab(usePathname(), machineId);
  const notify = useCallback((message: string) => setSuccessMessage(message), []);
  const notifyError = useCallback((message: string) => setErrorMessage(message), []);
  const dismissSuccess = useCallback(() => setSuccessMessage(null), []);
  const dismissError = useCallback(() => setErrorMessage(null), []);
  useOfflineHistorySync(machineId, service, notify);
  useEffect(() => prefetchMachineDetail(service, machineId), [machineId]);

  const contextValue = useMemo(
    () => ({ machineId, machine: machine.data, service, notify, notifyError }),
    [machineId, machine.data, notify, notifyError],
  );

  if (machine.error && !machine.data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-surfaceGray">
        <LoadErrorState message={machine.error} onRetry={machine.reload} />
        <LinkButton href="/machines" variant="ghost">Back to machines</LinkButton>
      </div>
    );
  }

  const changeStatus = async (status: OperatingStatus) => {
    const saved = await service.updateStatus(machineId, status);
    if (machine.data) machine.setData({ ...machine.data, status: saved });
  };

  return (
    <MachineDetailProvider value={contextValue}>
      <div className="flex h-screen flex-col bg-surfaceGray">
        <MachineHeaderBar machine={machine.data} onStatusChange={changeStatus} />
        <div className="flex min-h-0 flex-1">
          {activeTab === "components" && <SystemsSideNav />}
          <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            <div className="flex flex-wrap gap-4">
              <MachinePhotoGallery />
              <MachineSpecList />
            </div>
            <MachineTabs machineId={machineId} active={activeTab} openCaseCount={machine.data?.openCaseCount ?? null} />
            {children}
          </main>
        </div>
      </div>
      {successMessage && <SavedToast key={successMessage} message={successMessage} onDismiss={dismissSuccess} />}
      {errorMessage && <ErrorToast key={errorMessage} message={errorMessage} onDismiss={dismissError} />}
    </MachineDetailProvider>
  );
};
