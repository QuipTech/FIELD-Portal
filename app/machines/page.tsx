"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { CollapsibleSearch } from "@/components/shell/collapsibleSearch";
import { Tag } from "@/components/ui/tag";
import { Icon } from "@/components/icons/icon";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PermissionView } from "@/components/auth/permissionView";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { findMachine } from "@/lib/mockData/machines";
import { FeaturedDownMachineCard } from "./components/featuredDownMachineCard";
import { MachinesFilterCard } from "./components/machinesFilterCard";
import { MachinesTable } from "./components/machinesTable";

const MachinesPage = () => {
  const featuredMachine = findMachine("HT-2201");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <AppShell
      topBar={
        <TopBar
          actions={
            <>
              <Tag>Technician view <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
            </>
          }
        >
          <CollapsibleSearch
            placeholder="Search machines, manuals, cases"
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </TopBar>
      }
    >
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-center">
          <h1 className="text-[22px] font-medium text-ink">Machines</h1>
          <PermissionButton permission={PERMISSIONS.registerMachine} variant="primary" className="ml-auto">
            <Icon name="plus" />
            Add machine
          </PermissionButton>
        </div>
        <PermissionView permission={PERMISSIONS.viewMachines}>
          {featuredMachine ? (
            <FeaturedDownMachineCard machine={featuredMachine} fault="Brake pressure alarm" caseId="1042" />
          ) : null}
          <div className="flex min-h-0 flex-1 gap-3.5">
            <MachinesTable query={searchQuery} />
            <MachinesFilterCard />
          </div>
        </PermissionView>
      </main>
    </AppShell>
  );
};

export default MachinesPage;
