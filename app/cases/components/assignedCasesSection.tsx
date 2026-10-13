"use client";

import { LoadErrorState } from "@/components/ui/loadErrorState";
import { CaseListSkeleton } from "@/components/supportCases/caseListSkeleton";
import { CaseQueueTable } from "@/components/supportCases/caseQueueTable";
import { useSupportStaffAccess } from "@/lib/hooks/useSupportStaffAccess";
import { useAssignedCases } from "../useAssignedCases";

const assignedCaseHref = (caseNumber: number) => `/cases/assigned/${caseNumber}`;

// Cases the admin assigned to this person, from any company, above their
// own company's cases. Shown to support staff only.
export const AssignedCasesSection = () => {
  const { isStaff } = useSupportStaffAccess();
  const cases = useAssignedCases(isStaff);
  if (!isStaff) return null;
  const items = cases.data?.items ?? [];

  const renderBody = () => {
    if (!cases.data && cases.isLoading) return <CaseListSkeleton />;
    if (cases.error) return <LoadErrorState message={cases.error} onRetry={cases.reload} />;
    if (items.length === 0) return <p className="text-sm text-mutedGray">No open cases are assigned to you.</p>;
    return <CaseQueueTable items={items} caseHref={assignedCaseHref} />;
  };

  return (
    <section className="flex flex-none flex-col gap-2.5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[15px] font-medium text-ink">Assigned to you</h2>
        {items.length > 0 && <span className="text-xs text-mutedGray">{items.length} open</span>}
      </div>
      {renderBody()}
    </section>
  );
};
