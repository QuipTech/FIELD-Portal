import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { MachineGroupsDirectory } from "./components/machineGroupsDirectory";

const MachineGroupsPage = () => (
  <AdminShell topBar={<AdminTopBar label="Machine groups" />}>
    <main className="m-4 flex min-w-0 flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-6">
      <MachineGroupsDirectory />
    </main>
  </AdminShell>
);

export default MachineGroupsPage;
