"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { ConnectByIdButton } from "@/components/machineControl/connectByIdButton";
import { ConnectMachineButton } from "@/components/machineControl/connectMachineButton";
import { DevicesTable } from "@/components/machineControl/devicesTable";
import { useMcDevicesContext } from "@/components/machineControl/mcDevicesContext";
import { matchesDeviceSearch } from "@/lib/types/machineControl";

// Devices: every connected tablet, searchable, online ones first.
const MachineControlDevicesPage = () => {
  const { data, isLoading, error, reload } = useMcDevicesContext();
  const [search, setSearch] = useState("");
  const devices = data?.items ?? [];
  const visible = devices.filter((device) => matchesDeviceSearch(device, search));

  if (isLoading && !data) {
    return (
      <div aria-busy="true" aria-label="Loading devices" className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <SkeletonBar key={row} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (error && !data) return <LoadErrorState message={error} onRetry={reload} />;
  if (devices.length === 0) {
    return (
      <EmptyState
        icon="broadcast"
        title="No machines connected yet"
        description="Add a machine's tablet with its FIELD ID and password. It shows up here with whether it's online."
        actions={<ConnectMachineButton label="Connect your first machine" />}
      />
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          icon="search"
          aria-label="Search devices"
          placeholder="Search by machine, site, FIELD ID or serial"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-sm"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ConnectByIdButton />
          <ConnectMachineButton />
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState
          icon="search"
          title={`Nothing matches "${search}"`}
          description="Try a Plant ID, a site or the tablet's serial."
          actions={<Button onClick={() => setSearch("")}>Clear search</Button>}
        />
      ) : (
        <DevicesTable devices={visible} />
      )}
    </section>
  );
};

export default MachineControlDevicesPage;
