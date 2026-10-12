import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { AdminOverviewView } from "./components/adminOverviewView";

const AdminOverviewPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Overview" />}>
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="m-4 flex flex-1 flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-6">
          <AdminOverviewView />
        </main>
      </div>
    </AdminShell>
  );
};

export default AdminOverviewPage;
