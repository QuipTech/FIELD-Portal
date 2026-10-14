"use client";

import { useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { useCaseEvents } from "@/lib/hooks/useCaseEvents";
import { usePageReset } from "@/lib/hooks/usePageReset";
import { listSupportCasesRequest } from "@/lib/api/supportCasesApi";
import type { CaseStatusFilter } from "@/lib/types/supportCase";

// The organisation's cases about one machine, open ones by default. Kept
// live like the Support cases list.
export const useMachineCases = (machineId: string) => {
  const [status, setStatus] = useState<CaseStatusFilter>("active");
  const [page, setPage] = usePageReset([status]);

  const cases = useApiResource(
    (accessToken) => listSupportCasesRequest(accessToken, { status, priority: "", search: "", machineId }, page),
    [machineId, status, page],
    "Couldn't load this machine's cases. Please try again.",
  );

  useCaseEvents({ onCaseUpdated: cases.reload });

  return { status, setStatus, cases, page, setPage };
};
