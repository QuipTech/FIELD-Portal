import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { SupportStaffView } from "@/components/supportCases/supportStaffView";
import { AdminCasesQueue } from "./components/adminCasesQueue";

// Support staff only: the admin (Owner), Support Agents and QuipTech's team.
const AdminCasesPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Support cases" />}>
      <main className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
        <SupportStaffView>
          <AdminCasesQueue />
        </SupportStaffView>
      </main>
    </AdminShell>
  );
};

export default AdminCasesPage;
