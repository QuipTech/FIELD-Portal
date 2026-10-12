"use client";

import { useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { listSubscriptionsRequest, saveSubscriptionRequest } from "@/lib/api/subscriptionsApi";
import type { SubscriptionPayload, SubscriptionStatus } from "@/lib/types/tenantSubscription";

export const useSubscriptions = () => {
  // "" = all organisations.
  const [status, setStatus] = useState<SubscriptionStatus | "">("");
  const list = useApiResource(
    (accessToken) => listSubscriptionsRequest(accessToken, status || undefined),
    [status],
    "Couldn't load subscriptions. Please try again.",
  );

  // Rejects with the API's error so the editor can show it. Reloads the
  // list, since the organisation's status (and the filter counts) may move.
  const saveSubscription = async (tenantId: string, payload: SubscriptionPayload) => {
    await saveSubscriptionRequest(requireAccessToken(), tenantId, payload);
    list.reload();
  };

  return {
    status,
    setStatus,
    list: list.data,
    isLoading: list.isLoading,
    loadError: list.error,
    saveSubscription,
  };
};
