import { apiRequest } from "./httpClient";
import type { AnnualQuote, OrganisationBillingSummary, OrganisationInvoice, OrganisationPlan } from "../types/organisationBilling";

// The organisation's own billing (billing.manage: Owner, Organisation Admin).
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const getOrganisationBillingRequest = (accessToken: string) =>
  apiRequest<OrganisationBillingSummary>("/organisation/billing", { headers: authorizationHeader(accessToken) });

export const getAnnualQuoteRequest = (accessToken: string, committedQty: number) =>
  apiRequest<AnnualQuote>(`/organisation/billing/annual-quote?committedQty=${committedQty}`, {
    headers: authorizationHeader(accessToken),
  });

// Annual (committing to a number of machines) or monthly, from the next renewal.
export const chooseNextTermRequest = (
  accessToken: string,
  choice: { term: "monthly" } | { term: "annual"; committedQty: number },
) =>
  apiRequest<OrganisationPlan>("/organisation/billing/next-term", {
    method: "PUT",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(choice),
  });

export const cancelPlanRequest = (accessToken: string, reason: string) =>
  apiRequest<OrganisationPlan>("/organisation/billing/cancel", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify({ reason }),
  });

export const keepPlanRequest = (accessToken: string) =>
  apiRequest<OrganisationPlan>("/organisation/billing/cancel", {
    method: "DELETE",
    headers: authorizationHeader(accessToken),
  });

export const listOrganisationInvoicesRequest = (accessToken: string) =>
  apiRequest<OrganisationInvoice[]>("/organisation/billing/invoices", { headers: authorizationHeader(accessToken) });

export const getOrganisationInvoicePdfRequest = (accessToken: string, invoiceId: string) =>
  apiRequest<{ url: string }>(`/organisation/billing/invoices/${invoiceId}/pdf`, {
    headers: authorizationHeader(accessToken),
  });

// Stripe's Customer Portal: add a card or direct debit so invoices are charged automatically.
export const createOrganisationPortalSessionRequest = (accessToken: string) =>
  apiRequest<{ url: string }>("/organisation/billing/portal-session", {
    method: "POST",
    headers: authorizationHeader(accessToken),
  });
