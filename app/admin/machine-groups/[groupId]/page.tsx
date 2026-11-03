import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { MachineGroupDetail } from "./components/machineGroupDetail";

interface MachineGroupPageProps {
  params: { groupId: string };
}

// /admin/machine-groups/:groupId — one group's machines, who it's shared
// with and its activity.
const MachineGroupPage = ({ params }: MachineGroupPageProps) => (
  <AdminShell topBar={<AdminTopBar label="Machine groups" />}>
    <main className="m-4 flex min-w-0 flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-6">
      <MachineGroupDetail groupId={params.groupId} />
    </main>
  </AdminShell>
);

export default MachineGroupPage;
