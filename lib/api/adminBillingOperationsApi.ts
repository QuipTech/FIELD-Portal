import { apiRequest } from "./httpClient";
import type {
  BillingConfigEntry,
  CreditNote,
  NewPriceBook,
  OnboardingJob,
  PriceBook,
  ReviewTask,
} from "../types/adminBillingOperations";

// Platform admin (platform.manage) billing operations. Every change is audited by the API.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });
const post = <T>(accessToken: string, path: string, body: unknown = {}, method = "POST") =>
  apiRequest<T>(path, { method, headers: authorizationHeader(accessToken), body: JSON.stringify(body) });

// Allowed 14 days after an overdue invoice's first notice; pauses new activations and AI sessions only.
export const suspendAccountRequest = (accessToken: string, accountId: string, reason: string) =>
  post(accessToken, `/admin/billing/accounts/${accountId}/suspend`, { reason });

export const unsuspendAccountRequest = (accessToken: string, accountId: string, reason: string) =>
  post(accessToken, `/admin/billing/accounts/${accountId}/unsuspend`, { reason });

export const setUpEnterpriseRequest = (
  accessToken: string,
  accountId: string,
  input: { annualQuoteCents: number; committedMachines: number; reason: string },
) => post(accessToken, `/admin/billing/accounts/${accountId}/enterprise`, input);

export const listCreditNotesRequest = (accessToken: string, invoiceId: string) =>
  apiRequest<CreditNote[]>(`/admin/billing/invoices/${invoiceId}/credit-notes`, {
    headers: authorizationHeader(accessToken),
  });

export const createCreditNoteRequest = (
  accessToken: string,
  invoiceId: string,
  input: { amountCents: number; reason: string },
) => post<CreditNote>(accessToken, `/admin/billing/invoices/${invoiceId}/credit-notes`, input);

export const retryCreditNoteRequest = (accessToken: string, creditNoteId: string) =>
  post<CreditNote>(accessToken, `/admin/billing/credit-notes/${creditNoteId}/retry`);

// Monthly drafts wait 24 hours for review; a held draft waits until released.
export const holdInvoiceRequest = (accessToken: string, invoiceId: string, reason: string) =>
  post(accessToken, `/admin/billing/invoices/${invoiceId}/hold`, { reason });

export const releaseInvoiceRequest = (accessToken: string, invoiceId: string) =>
  post(accessToken, `/admin/billing/invoices/${invoiceId}/release`);

export const listOnboardingJobsRequest = (accessToken: string) =>
  apiRequest<OnboardingJob[]>("/admin/billing/onboarding", { headers: authorizationHeader(accessToken) });

export const scheduleOnboardingRequest = (accessToken: string, billingAccountId: string, siteName: string) =>
  post<{ id: string }>(accessToken, "/admin/billing/onboarding", { billingAccountId, siteName });

export const completeOnboardingRequest = (accessToken: string, jobId: string) =>
  post<{ id: string; invoiceId: string }>(accessToken, `/admin/billing/onboarding/${jobId}/complete`);

export const waiveOnboardingRequest = (accessToken: string, jobId: string, reason: string) =>
  post(accessToken, `/admin/billing/onboarding/${jobId}/waive`, { reason });

export const listPriceBooksRequest = (accessToken: string) =>
  apiRequest<PriceBook[]>("/admin/billing/price-books", { headers: authorizationHeader(accessToken) });

export const createPriceBookRequest = (accessToken: string, input: NewPriceBook) =>
  post<{ id: string; version: number }>(accessToken, "/admin/billing/price-books", input);

export const listBillingConfigRequest = (accessToken: string) =>
  apiRequest<BillingConfigEntry[]>("/admin/billing/config", { headers: authorizationHeader(accessToken) });

export const updateBillingConfigRequest = (accessToken: string, key: string, value: number | string | null) =>
  post(accessToken, `/admin/billing/config/${key}`, { value }, "PUT");

export const listReviewTasksRequest = (accessToken: string, status: "open" | "closed") =>
  apiRequest<ReviewTask[]>(`/admin/billing/review-tasks?status=${status}`, { headers: authorizationHeader(accessToken) });

export const updateReviewTaskRequest = (
  accessToken: string,
  taskId: string,
  input: { status: ReviewTask["status"]; notes?: string },
) => post(accessToken, `/admin/billing/review-tasks/${taskId}`, input, "PATCH");
