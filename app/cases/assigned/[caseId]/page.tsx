import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { SupportStaffView } from "@/components/supportCases/supportStaffView";
import { AdminCaseView } from "@/components/supportCases/staffCase/adminCaseView";

interface AssignedCasePageProps {
  params: { caseId: string };
}

// /cases/assigned/1042 — a case the admin assigned to this person, worked
// inside the client portal. The API answers 404 for any case not theirs.
const AssignedCasePage = ({ params }: AssignedCasePageProps) => {
  const caseNumber = Number(params.caseId);
  if (!Number.isInteger(caseNumber) || caseNumber <= 0) notFound();

  return (
    <AppShell
      topBar={
        <TopBar showUserMenu={false}>
          <span className="text-[15px] text-bodyGray">Support cases</span>
        </TopBar>
      }
    >
      <SupportStaffView className="m-8">
        <AdminCaseView caseNumber={caseNumber} backHref="/cases" />
      </SupportStaffView>
    </AppShell>
  );
};

export default AssignedCasePage;
