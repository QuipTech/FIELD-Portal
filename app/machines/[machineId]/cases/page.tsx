"use client";

import { EmptyState } from "@/components/ui/emptyState";
import { FilterChipSelect } from "@/components/ui/filterChipSelect";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { Pagination } from "@/components/ui/pagination";
import { CaseListSkeleton } from "@/components/supportCases/caseListSkeleton";
import { CasesTable } from "@/components/supportCases/casesTable";
import { NewCaseButton } from "@/components/supportCases/newCaseButton";
import type { CaseStatusFilter } from "@/lib/types/supportCase";
import { useMachineDetail } from "../machineDetailContext";
import { canContributeTo } from "@/lib/machineDetail/machineAccessRules";
import { useMachineCases } from "./useMachineCases";

const STATUS_OPTIONS: { value: CaseStatusFilter; label: string }[] = [
  { value: "active", label: "Open cases" },
  { value: "all", label: "All cases" },
];

// Open cases tab: this machine's support cases. A row opens the case screen.
const MachineCasesPage = () => {
  const { machineId, machine } = useMachineDetail();
  const { status, setStatus, cases, page, setPage } = useMachineCases(machineId);
  const items = cases.data?.items ?? [];

  const renderBody = () => {
    if (!cases.data && cases.isLoading) return <CaseListSkeleton />;
    if (cases.error) return <LoadErrorState message={cases.error} onRetry={cases.reload} />;
    if (items.length > 0) return <CasesTable cases={items} />;
    return (
      <EmptyState
        icon="life"
        title={status === "active" ? "No open cases for this machine" : "No cases for this machine yet"}
        description={
          canContributeTo(machine)
            ? "Something wrong with this machine? Raise a case and our support team will pick it up."
            : undefined
        }
        actions={canContributeTo(machine) ? <NewCaseButton initialDraft={{ machineId }} isMachineFixed /> : undefined}
      />
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <FilterChipSelect
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={(value) => setStatus(value as CaseStatusFilter)}
        isActive
      />
      {renderBody()}
      {cases.data && (
        <Pagination page={page} pageSize={cases.data.pageSize} total={cases.data.total} onPageChange={setPage} />
      )}
    </section>
  );
};

export default MachineCasesPage;
