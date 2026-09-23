import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { RolesList } from "./components/rolesList";
import { PermissionsPanel } from "./components/permissionsPanel";

const RolesPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Roles" showBell={false} />}>
      <main className="m-4 flex flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6">
        <div className="flex items-center">
          <h1 className="text-[22px] font-medium text-ink">Roles &amp; permissions</h1>
          <Button variant="primary" className="ml-auto">
            <Icon name="plus" />
            New role
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 gap-4">
          <RolesList />
          <PermissionsPanel />
        </div>
      </main>
    </AdminShell>
  );
};

export default RolesPage;
