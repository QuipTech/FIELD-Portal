"use client";

import { LoadErrorState } from "@/components/ui/loadErrorState";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { useMcDevicesContext } from "@/components/machineControl/mcDevicesContext";
import { ConnectedMachinesCard } from "@/components/machineControl/overview/connectedMachinesCard";
import { GettingStartedCard } from "@/components/machineControl/overview/gettingStartedCard";
import { OverviewStats } from "@/components/machineControl/overview/overviewStats";
import { summariseDevices } from "@/lib/types/machineControl";

// Overview: how many machines are connected and live, what to do next, and
// the connected machines themselves.
const MachineControlOverviewPage = () => {
  const { data, isLoading, error, reload } = useMcDevicesContext();

  if (isLoading && !data) {
    return (
      <div aria-busy="true" aria-label="Loading Machine Control" className="flex flex-col gap-3">
        <div className="flex gap-3">
          {[0, 1, 2].map((tile) => (
            <SkeletonBar key={tile} className="h-[104px] flex-1 rounded-2xl" />
          ))}
        </div>
        <SkeletonBar className="h-44 w-full rounded-2xl" />
      </div>
    );
  }
  if (error && !data) return <LoadErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const summary = summariseDevices(data);
  return (
    <div className="flex flex-col gap-4">
      <OverviewStats summary={summary} />
      <GettingStartedCard hasConnectedMachine={summary.connected > 0} />
      {data.items.length > 0 && <ConnectedMachinesCard devices={data.items} />}
    </div>
  );
};

export default MachineControlOverviewPage;
