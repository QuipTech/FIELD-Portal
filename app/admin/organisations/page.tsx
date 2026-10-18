import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { OrganisationDirectory } from "./components/organisationDirectory";
const OrganisationsPage = () => (
  <AdminShell topBar={<AdminTopBar label="Organisations" />}>
    <main className="m-4 flex min-w-0 flex-1 flex-col gap-4 overflow-auto rounded-2xl border border-borderGray bg-surface p-6">
      <h1 className="text-[22px] font-medium text-ink">Organisation Knowledge access</h1>
      <OrganisationDirectory />
    </main>
  </AdminShell>
);
export default OrganisationsPage;
