"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { CollapsibleSearch } from "@/components/shell/collapsibleSearch";
import { Tag } from "@/components/ui/tag";
import { Icon } from "@/components/icons/icon";
import { PermissionView } from "@/components/auth/permissionView";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { AddMachineButton } from "./components/addMachineButton";
import { MachineFleetView } from "./components/machineFleetView";

const MachinesPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  return (
    <AppShell
      topBar={
        <TopBar
          actions={
            <Tag>
              Technician view <Icon name="chevd" className="h-3.5 w-3.5" />
            </Tag>
          }
        >
          <CollapsibleSearch placeholder="Search machines" value={searchQuery} onChange={setSearchQuery} />
        </TopBar>
      }
    >
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-center">
          <h1 className="text-[22px] font-medium text-ink">Machines</h1>
          <AddMachineButton onRegistered={() => setReloadToken((token) => token + 1)} />
        </div>
        <PermissionView permission={PERMISSIONS.viewMachines}>
          <MachineFleetView search={searchQuery} reloadToken={reloadToken} />
        </PermissionView>
      </main>
    </AppShell>
  );
};

export default MachinesPage;
