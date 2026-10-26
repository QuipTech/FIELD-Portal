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
import { machineCacheKeys, machineKeyPrefix } from "@/lib/machineDetail/machineDetailCacheKeys";
import { invalidateCached } from "@/lib/machineDetail/resourceCache";
import type { OperatingStatus } from "@/lib/types/machineFleet";
import type { LifecycleChangeResult } from "@/lib/types/machineLifecycle";
import { MachineDetailProvider } from "../machineDetailContext";
import { useOfflineHistorySync } from "../useOfflineHistorySync";
import { prefetchMachineDetail } from "../prefetchMachineDetail";
import { MachineHeaderBar } from "./machineHeaderBar";
import { MachineActivationBanner } from "./machineActivationBanner";
import { MachineLifecycleCard } from "@/components/machines/lifecycle/machineLifecycleCard";
import { MachinePhotoGallery } from "./machinePhotoGallery";
import { MachineSpecList } from "./machineSpecList";
import { SystemsTabs } from "./systemsTabs";
import { AppShell } from "@/components/shell/appShell";

const ROUTED_TABS: MachineTab[] = ["history", "config-history", "manuals", "cases"];

const LIFECYCLE_NOTICES: Record<LifecycleChangeResult["action"], string> = {
  activate: "Machine activated.",
  reactivate: "Machine reactivated.",
  deactivate: "Machine deactivated. It stops counting toward billing from the 1st of next month.",
  archive: "Machine archived. It stops counting toward billing from the 1st of next month.",
  sell: "Machine transferred.",
};

const toActiveTab = (pathname: string, machineId: string): MachineTab => {
  const section = pathname.slice(`/machines/${machineId}`.length).split("/")[1];
  return ROUTED_TABS.find((tab) => tab === section) ?? "components";
};

// Everything above the tab content, shared by every machine detail tab:
// breadcrumb and actions (as the app shell's top bar, beside the main side
// nav), photo gallery, info card, tabs and, on Components, the systems. The tab
// renders at once and loads in parallel with the machine itself.
export const MachineDetailShell = ({ machineId, children }: { machineId: string; children: ReactNode }) => {
  const machine = useCachedResource(machineCacheKeys.machine(machineId), () => service.getMachine(machineId), "Couldn't load this machine.");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Bumped on activation: remounts the content so every tab loads afresh.
  const [contentVersion, setContentVersion] = useState(0);
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

  // What the machine refused (403) or allowed is cached; drop it all.
  const handleLifecycleChange = (result: LifecycleChangeResult) => {
    invalidateCached(machineKeyPrefix(machineId));
    if (machine.data) machine.setData({ ...machine.data, lifecycleState: result.lifecycleState });
    setContentVersion((version) => version + 1);
    notify(LIFECYCLE_NOTICES[result.action]);
  };

  return (
    <MachineDetailProvider value={contextValue}>
      <AppShell topBar={<MachineHeaderBar machine={machine.data} onStatusChange={changeStatus} />}>
        <main key={contentVersion} className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {machine.data && <MachineActivationBanner machine={machine.data} onActivated={handleLifecycleChange} />}
          <div className="flex flex-wrap gap-4">
            <MachinePhotoGallery />
            <MachineSpecList />
          </div>
          {machine.data && (
            <MachineLifecycleCard
              machineId={machineId}
              machineLabel={machine.data.assetId}
              lifecycleState={machine.data.lifecycleState}
              onChanged={handleLifecycleChange}
            />
          )}
          <MachineTabs machineId={machineId} active={activeTab} openCaseCount={machine.data?.openCaseCount ?? null} />
          {activeTab === "components" && <SystemsTabs />}
          {children}
        </main>
      </AppShell>
      {successMessage && <SavedToast key={successMessage} message={successMessage} onDismiss={dismissSuccess} />}
      {errorMessage && <ErrorToast key={errorMessage} message={errorMessage} onDismiss={dismissError} />}
    </MachineDetailProvider>
  );
};
