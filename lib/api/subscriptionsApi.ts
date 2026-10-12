import { apiRequest } from "./httpClient";
import type {
  SubscriptionPayload,
  SubscriptionStatus,
  TenantSubscription,
  TenantSubscriptionList,
} from "../types/tenantSubscription";

// Every organisation's subscription. Owner role only.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

// statusCounts always covers every organisation, whatever the filter.
export const listSubscriptionsRequest = (accessToken: string, status?: SubscriptionStatus) =>
  apiRequest<TenantSubscriptionList>(`/admin/subscriptions${status ? `?status=${status}` : ""}`, {
    headers: authorizationHeader(accessToken),
  });

// Sets up or replaces the organisation's whole subscription.
export const saveSubscriptionRequest = (accessToken: string, tenantId: string, payload: SubscriptionPayload) =>
  apiRequest<TenantSubscription>(`/admin/subscriptions/${tenantId}`, {
    method: "PUT",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(payload),
  });
