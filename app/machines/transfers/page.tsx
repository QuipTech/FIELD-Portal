"use client";

import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { PermissionView } from "@/components/auth/permissionView";
import { LinkButton } from "@/components/ui/linkButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { TransfersView } from "./transfersView";

const MachineTransfersPage = () => (
  <AppShell topBar={<TopBar><span className="text-[15px] text-bodyGray">Machine transfers</span></TopBar>}>
    <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      <div className="flex items-center gap-3">
        <LinkButton href="/machines" variant="ghost">Back</LinkButton>
        <h1 className="text-[22px] font-medium text-ink">Machine transfers</h1>
      </div>
      <PermissionView permission={PERMISSIONS.manageMachineLifecycle}>
        <TransfersView />
      </PermissionView>
    </main>
  </AppShell>
);

export default MachineTransfersPage;
