import { notFound } from "next/navigation";
import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { SupportStaffView } from "@/components/supportCases/supportStaffView";
import { AdminCaseView } from "./components/adminCaseView";

interface AdminCasePageProps {
  params: { caseId: string };
}

// /admin/cases/1042 — the case number. The API answers 404 to a Support
// Agent for any case not assigned to them.
const AdminCasePage = ({ params }: AdminCasePageProps) => {
  const caseNumber = Number(params.caseId);
  if (!Number.isInteger(caseNumber) || caseNumber <= 0) notFound();

  return (
    <AdminShell topBar={<AdminTopBar label="Support cases" />}>
      <SupportStaffView className="m-8">
        <AdminCaseView caseNumber={caseNumber} />
      </SupportStaffView>
    </AdminShell>
  );
};

export default AdminCasePage;
