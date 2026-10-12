import { apiRequest } from "./httpClient";
import type {
  DemoRequest,
  DemoRequestListQuery,
  DemoRequestPage,
  DemoRequestUpdate,
  ResendEmailsResult,
} from "../types/demoRequest";

// Demo requests from the marketing site. Owner (platform.manage) only.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const toQueryString = (query: DemoRequestListQuery): string => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return `?${params.toString()}`;
};

// Newest first.
export const listDemoRequestsRequest = (accessToken: string, query: DemoRequestListQuery) =>
  apiRequest<DemoRequestPage>(`/admin/demo-requests${toQueryString(query)}`, {
    headers: authorizationHeader(accessToken),
  });

export const getDemoRequestRequest = (accessToken: string, requestId: string) =>
  apiRequest<DemoRequest>(`/admin/demo-requests/${requestId}`, { headers: authorizationHeader(accessToken) });

// Status and notes only; blank notes clear them.
export const updateDemoRequestRequest = (accessToken: string, requestId: string, update: DemoRequestUpdate) =>
  apiRequest<DemoRequest>(`/admin/demo-requests/${requestId}`, {
    method: "PATCH",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(update),
  });

// Retries whichever of the team / confirmation emails hasn't been sent.
export const resendDemoRequestEmailsRequest = (accessToken: string, requestId: string) =>
  apiRequest<ResendEmailsResult>(`/admin/demo-requests/${requestId}/resend-emails`, {
    method: "POST",
    headers: authorizationHeader(accessToken),
  });
