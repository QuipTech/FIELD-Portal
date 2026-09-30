"use client";

import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useSupportCases } from "../useSupportCases";
import { CasesFilterBar } from "./casesFilterBar";
import { CasesTable } from "./casesTable";

export const CasesManager = () => {
  const { filters, updateFilter, isFiltered, cases, options } = useSupportCases();
  const items = cases.data?.items ?? [];

  const renderBody = () => {
    if (!cases.data && cases.isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center text-mutedGray">
          <LoadingSpinner size="md" />
        </div>
      );
    }
    if (cases.error) return <p className="text-sm text-danger">{cases.error}</p>;
    if (items.length === 0) {
      return (
        <p className="py-10 text-center text-sm text-mutedGray">
          {isFiltered || filters.status !== "active"
            ? "No cases match these filters."
            : "No open support cases. Raise one with New case."}
        </p>
      );
    }
    return <CasesTable cases={items} />;
  };

  return (
    <>
      <CasesFilterBar
        filters={filters}
        statusCounts={cases.data?.statusCounts ?? null}
        options={options}
        onChange={updateFilter}
      />
      {renderBody()}
    </>
  );
};
