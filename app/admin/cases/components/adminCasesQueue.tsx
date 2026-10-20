"use client";

import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/emptyState";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { CaseListSkeleton } from "@/components/supportCases/caseListSkeleton";
import { QUEUE_PAGE_SIZE, useAdminCaseQueue } from "../useAdminCaseQueue";
import { CaseQueueStats } from "./caseQueueStats";
import { CaseQueueTabs } from "./caseQueueTabs";
import { CaseQueueFilters } from "./caseQueueFilters";
import { CaseQueueTable } from "@/components/supportCases/caseQueueTable";

const EMPTY_TITLES = {
  unassigned: "Nothing waiting to be assigned",
  mine: "No open cases assigned to you",
  open: "No open cases",
  resolved: "No resolved cases yet",
};

// A13: every customer case (or, for a Support Agent, their own).
export const AdminCasesQueue = () => {
  const { isAdmin, filters, updateFilter, page, setPage, cases, stats, organisations } = useAdminCaseQueue();
  const list = cases.data;

  const renderBody = () => {
    if (!list && cases.isLoading) return <CaseListSkeleton />;
    if (cases.error) return <LoadErrorState message={cases.error} onRetry={cases.reload} />;
    if (!list || list.items.length === 0) return <EmptyState icon="life" title={EMPTY_TITLES[filters.tab]} />;
    return <CaseQueueTable items={list.items} />;
  };

  return (
    <>
      <div className="flex items-center gap-5">
        <h1 className="text-[26px] font-medium text-ink">Support cases</h1>
        <span className="text-sm text-mutedGray">Cases raised by customers in the portal and mobile app</span>
        <Input
          icon="search"
          placeholder="Search case, company, subject"
          aria-label="Search cases"
          value={filters.search}
          onChange={(event) => updateFilter("search", event.target.value)}
          className="ml-auto w-[360px]"
        />
      </div>
      <CaseQueueStats stats={stats.data} />
      <div className="flex items-end gap-4">
        <CaseQueueTabs
          value={filters.tab}
          stats={stats.data}
          isAdmin={isAdmin}
          onChange={(tab) => updateFilter("tab", tab)}
        />
        <CaseQueueFilters filters={filters} organisations={organisations} onChange={updateFilter} />
      </div>
      {renderBody()}
      {list && <Pagination page={page} pageSize={QUEUE_PAGE_SIZE} total={list.total} onPageChange={setPage} />}
      <p className="max-w-xl text-sm text-mutedGray">
        New cases land unassigned. Assigning a case notifies the assignee; setting &quot;Waiting on customer&quot;
        pauses the SLA clock until the customer replies.
      </p>
    </>
  );
};
