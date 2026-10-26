"use client";

import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { createBillingAccountRequest, listOrganisationBillingRequest } from "@/lib/api/billingAccountsApi";
import type { NewBillingAccount } from "@/lib/types/billingAccount";

export const useBillingAccounts = () => {
  const list = useApiResource(
    (accessToken) => listOrganisationBillingRequest(accessToken),
    [],
    "Couldn't load organisations. Please try again.",
  );

  // Rejects with the API's error so the form can show it.
  const createAccount = async (account: NewBillingAccount) => {
    await createBillingAccountRequest(requireAccessToken(), account);
    list.reload();
  };

  return {
    organisations: list.data,
    isLoading: list.isLoading,
    loadError: list.error,
    createAccount,
    reload: list.reload,
  };
};
