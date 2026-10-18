import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { BrandManager } from "./components/brandManager";

const KnowledgeBrandsPage = () => (
  <AdminShell topBar={<AdminTopBar label="Knowledge brands" />}>
    <main className="m-4 flex min-w-0 flex-1 flex-col gap-4 overflow-auto rounded-2xl border border-borderGray bg-surface p-6">
      <BrandManager />
    </main>
  </AdminShell>
);
export default KnowledgeBrandsPage;
