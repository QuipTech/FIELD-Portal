import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { Icon } from "@/components/icons/icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ModelsList } from "./components/modelsList";
import { SystemTree } from "./components/systemTree";

const AdminMachineLibraryPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Machine library" showBell={false} />}>
      <main className="m-4 flex flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-medium text-ink">Machine library</h1>
          <Input icon="search" placeholder="Search models" className="ml-auto w-56" />
          <Button variant="primary">
            <Icon name="plus" />
            New model
          </Button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-2">
          <ModelsList />
          <SystemTree />
        </div>
      </main>
    </AdminShell>
  );
};

export default AdminMachineLibraryPage;
