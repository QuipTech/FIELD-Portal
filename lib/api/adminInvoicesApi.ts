import { apiRequest } from "./httpClient";
import type { AdminInvoiceCategory, AdminInvoiceList, StripeRefreshResult } from "../types/adminInvoice";

// Every invoice on the platform. Platform admin only.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export interface AdminInvoiceFilters {
  category?: AdminInvoiceCategory;
  search?: string;
  page: number;
  pageSize: number;
}

export const listAdminInvoicesRequest = (accessToken: string, filters: AdminInvoiceFilters) => {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) });
  if (filters.category) query.set("category", filters.category);
  if (filters.search) query.set("search", filters.search);
  return apiRequest<AdminInvoiceList>(`/admin/billing/overview/invoices?${query}`, {
    headers: authorizationHeader(accessToken),
  });
};

// Asks Stripe about unpaid invoices and records any it says are paid.
export const refreshInvoicesFromStripeRequest = (accessToken: string) =>
  apiRequest<StripeRefreshResult>("/admin/billing/overview/refresh-from-stripe", {
    method: "POST",
    headers: authorizationHeader(accessToken),
  });
