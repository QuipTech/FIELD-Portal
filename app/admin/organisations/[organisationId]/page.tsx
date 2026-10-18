import Link from "next/link";
import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { KnowledgeAccessSection } from "../components/knowledgeAccessSection";
const OrganisationPage = ({ params }: { params: { organisationId: string } }) => (
  <AdminShell topBar={<AdminTopBar label="Organisation" />}>
    <main className="m-4 flex min-w-0 flex-1 flex-col gap-4 overflow-auto rounded-2xl border border-borderGray bg-surface p-6">
      <Link href="/admin/organisations" className="text-sm text-primary">
        ← Organisations
      </Link>
      <KnowledgeAccessSection organisationId={params.organisationId} />
    </main>
  </AdminShell>
);
export default OrganisationPage;
