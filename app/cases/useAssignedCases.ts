"use client";

import { useApiResource } from "@/lib/hooks/useApiResource";
import { useCaseEvents } from "@/lib/hooks/useCaseEvents";
import { listAdminCasesRequest } from "@/lib/api/adminSupportCasesApi";
import type { AdminCaseFilters, AdminSupportCaseList } from "@/lib/types/adminSupportCase";

const ASSIGNED_PAGE_SIZE = 50;
// The queue's "mine" tab: open cases assigned to the viewer, any company.
const MINE: AdminCaseFilters = { tab: "mine", company: "", priority: "", status: "", search: "" };

// Support staff only (e.g. a Technical Manager the admin assigned a case
// to); live, so a new assignment appears without a refresh.
export const useAssignedCases = (isStaff: boolean) => {
  const cases = useApiResource<AdminSupportCaseList | null>(
    (token) => (isStaff ? listAdminCasesRequest(token, MINE, 1, ASSIGNED_PAGE_SIZE) : Promise.resolve(null)),
    [isStaff],
    "Couldn't load the cases assigned to you.",
  );
  useCaseEvents({
    onCaseUpdated: () => {
      if (isStaff) cases.reload();
    },
  });
  return cases;
};
