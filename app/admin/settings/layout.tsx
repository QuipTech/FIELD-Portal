import type { ReactNode } from "react";
import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { SettingsTabsNav } from "./components/settingsTabsNav";

const SettingsLayout = ({ children }: { children: ReactNode }) => {
  return (
    <AdminShell topBar={<AdminTopBar label="Settings" showBell={false} />}>
      <main className="m-4 flex flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-8">
        <SettingsTabsNav />
        {children}
      </main>
    </AdminShell>
  );
};

export default SettingsLayout;
