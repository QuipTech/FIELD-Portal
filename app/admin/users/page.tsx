import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { UsersDirectory } from "./components/usersDirectory";

const UsersPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Users" />}>
      <main className="m-4 flex flex-1 flex-col gap-3.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-6">
        <UsersDirectory />
      </main>
    </AdminShell>
  );
};

export default UsersPage;
