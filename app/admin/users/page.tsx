import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { Icon } from "@/components/icons/icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterButton } from "./components/filterButton";
import { UsersTable } from "./components/usersTable";

const UsersPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Users" showBell={false} />}>
      <main className="m-4 flex flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6">
        <div className="flex items-center">
          <h1 className="text-[22px] font-medium text-ink">Users</h1>
          <Button variant="primary" className="ml-auto">
            <Icon name="plus" />
            Invite user
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Input icon="search" placeholder="Search users" className="w-60" />
          <FilterButton>Role</FilterButton>
          <FilterButton>Site</FilterButton>
          <span className="ml-auto text-xs text-slate-400">53 users</span>
        </div>
        <UsersTable />
      </main>
    </AdminShell>
  );
};

export default UsersPage;
