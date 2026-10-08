"use client";

import { EmptyState } from "@/components/ui/emptyState";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { CaseListSkeleton } from "@/components/supportCases/caseListSkeleton";
import { useSupportCases } from "../useSupportCases";
import { CasesFilterBar } from "./casesFilterBar";
import { CasesTable } from "./casesTable";
import { NewCaseButton } from "./newCaseButton";

export const CasesManager = () => {
  const { filters, updateFilter, isFiltered, cases } = useSupportCases();
  const items = cases.data?.items ?? [];

  const renderBody = () => {
    if (!cases.data && cases.isLoading) return <CaseListSkeleton />;
    if (cases.error) return <LoadErrorState message={cases.error} onRetry={cases.reload} />;
    if (items.length > 0) return <CasesTable cases={items} />;
    return isFiltered ? (
      <EmptyState icon="search" title="No cases match these filters" />
    ) : (
      <EmptyState
        icon="life"
        title="No cases yet"
        description="Raise a case and QuipTech support will pick it up. You can chat with them right here."
        actions={<NewCaseButton />}
      />
    );
  };

  return (
    <>
      <CasesFilterBar filters={filters} statusCounts={cases.data?.statusCounts ?? null} onChange={updateFilter} />
      {renderBody()}
    </>
  );
};
