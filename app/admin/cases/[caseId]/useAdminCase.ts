"use client";

import { useApiResource } from "@/lib/hooks/useApiResource";
import { useLiveCaseThread } from "@/lib/hooks/useLiveCaseThread";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { getAdminCaseRequest, updateAdminCaseRequest } from "@/lib/api/adminSupportCasesApi";
import type { SupportCaseChanges } from "@/lib/types/supportCase";

// One case as staff see it (internal notes included), with its live thread.
export const useAdminCase = (caseNumber: number) => {
  const supportCase = useApiResource(
    (token) => getAdminCaseRequest(token, caseNumber),
    [caseNumber],
    "Couldn't load this case.",
  );
  // Live updates carry the case's shared fields; the company and the
  // viewer's role stay from the last full load.
  const thread = useLiveCaseThread("staff", caseNumber, (updated) =>
    supportCase.setData((current) => (current ? { ...current, ...updated } : current)),
  );

  const updateCase = async (changes: SupportCaseChanges): Promise<void> => {
    supportCase.setData(await updateAdminCaseRequest(requireAccessToken(), caseNumber, changes));
    thread.reloadEvents();
  };

  return { supportCase, thread, updateCase };
};
