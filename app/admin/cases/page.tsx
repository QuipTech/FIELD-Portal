import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { PermissionView } from "@/components/auth/permissionView";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { AdminCasesQueue } from "./components/adminCasesQueue";

// Support staff only: the admin (Owner) and Support Agents.
const AdminCasesPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Support cases" />}>
      <main className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
        <PermissionView permission={PERMISSIONS.workSupportCases}>
          <AdminCasesQueue />
        </PermissionView>
      </main>
    </AdminShell>
  );
};

export default AdminCasesPage;
