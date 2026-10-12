import { apiRequest } from "./httpClient";
import type { OrganisationSubscription } from "../types/organisationSubscription";

// The signed-in user's organisation plan (the free plan when it has none).
export const getOrganisationSubscriptionRequest = (accessToken: string) =>
  apiRequest<OrganisationSubscription>("/organisation/subscription", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
