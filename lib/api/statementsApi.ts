import { apiDownloadRequest, apiRequest } from "./httpClient";
import type {
  MonthEndFilters,
  MonthEndReport,
  MonthEndReportRow,
  OrganisationStatement,
  OverdueStatement,
  StatementExportFormat,
  StatementMachine,
} from "../types/billingStatement";

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });
const send = <T>(accessToken: string, path: string, method: string, body: unknown = {}) =>
  apiRequest<T>(path, { method, headers: authorizationHeader(accessToken), body: JSON.stringify(body) });

const FILE_NAME_PATTERN = /filename="([^"]+)"/;

const toQuery = (filters: MonthEndFilters, extra: Record<string, string> = {}) =>
  new URLSearchParams({
    month: filters.month,
    paymentType: filters.paymentType,
    ...(filters.status !== "all" && { status: filters.status }),
    ...extra,
  }).toString();

// ── Platform administrator: Billing → Month-end report ─────────────────

export const getMonthEndReportRequest = (accessToken: string, filters: MonthEndFilters) =>
  apiRequest<MonthEndReport>(`/admin/billing/statements/report?${toQuery(filters)}`, {
    headers: authorizationHeader(accessToken),
  });

export const exportMonthEndRequest = async (
  accessToken: string,
  filters: MonthEndFilters,
  format: StatementExportFormat,
  invoiceDate?: string,
) => {
  const { blob, headers } = await apiDownloadRequest(
    `/admin/billing/statements/export?${toQuery(filters, { format, ...(invoiceDate && { invoiceDate }) })}`,
    { headers: authorizationHeader(accessToken) },
  );
  // The API's own name when the browser can read it (CORS may hide it).
  const fallback =
    format === "zoho" ? `field-zoho-invoices-${filters.month}.csv` : `field-month-end-${filters.month}.${format === "xlsx" ? "xlsx" : "csv"}`;
  return { blob, fileName: FILE_NAME_PATTERN.exec(headers.get("Content-Disposition") ?? "")?.[1] ?? fallback };
};

export const getStatementMachinesRequest = (accessToken: string, statementId: string) =>
  apiRequest<StatementMachine[]>(`/admin/billing/statements/${statementId}/machines`, {
    headers: authorizationHeader(accessToken),
  });

export const markMonthReadyRequest = (accessToken: string, month: string) =>
  send<{ month: string; lockedCount: number }>(accessToken, "/admin/billing/statements/months/ready", "POST", { month });

export const setZohoInvoiceRequest = (
  accessToken: string,
  statementId: string,
  input: { invoiceNumber: string; invoiceDate: string; termsDays?: number },
) => send<MonthEndReportRow>(accessToken, `/admin/billing/statements/${statementId}/zoho-invoice`, "PATCH", input);

export const markStatementPaidRequest = (
  accessToken: string,
  statementId: string,
  input: { paidOn: string; reference?: string },
) => send<MonthEndReportRow>(accessToken, `/admin/billing/statements/${statementId}/paid`, "PATCH", input);

export const listOverdueStatementsRequest = (accessToken: string) =>
  apiRequest<OverdueStatement[]>("/admin/billing/statements/overdue", { headers: authorizationHeader(accessToken) });

// ── Organisation (billing.manage) ──────────────────────────────────────

export const listOrganisationStatementsRequest = (accessToken: string) =>
  apiRequest<OrganisationStatement[]>("/organisation/billing/statements", { headers: authorizationHeader(accessToken) });
