"use client";

import { useApiResource } from "@/lib/hooks/useApiResource";
import { useLiveCaseThread } from "@/lib/hooks/useLiveCaseThread";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { getSupportCaseRequest, reopenSupportCaseRequest } from "@/lib/api/supportCasesApi";

// One case as its customers see it, with its live thread.
export const useCaseThread = (caseNumber: number) => {
  const supportCase = useApiResource(
    (token) => getSupportCaseRequest(token, caseNumber),
    [caseNumber],
    "Couldn't load this case.",
  );
  const thread = useLiveCaseThread("customer", caseNumber, supportCase.setData);

  const reopen = async (): Promise<void> => {
    supportCase.setData(await reopenSupportCaseRequest(requireAccessToken(), caseNumber));
    thread.reloadEvents();
  };

  return { supportCase, thread, reopen };
};
