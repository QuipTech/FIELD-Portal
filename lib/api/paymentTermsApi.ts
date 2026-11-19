import { apiRequest } from "./httpClient";
import type {
  AccountApplication,
  AccountApplicationInput,
  AccountStatus,
  AccountTerms,
  OrganisationPaymentTerms,
  OverdueInvoice,
  PaymentMethod,
  PaymentType,
  PromoCode,
  PromoCodeTerms,
  PromoPreview,
  PromoRedemption,
} from "../types/paymentTerms";

const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });
const send = <T>(accessToken: string, path: string, method: string, body: unknown = {}) =>
  apiRequest<T>(path, { method, headers: authorizationHeader(accessToken), body: JSON.stringify(body) });

// ── Organisation (billing.manage) ──────────────────────────────────────

export const getPaymentTermsRequest = (accessToken: string) =>
  apiRequest<OrganisationPaymentTerms>("/organisation/billing/payment-terms", {
    headers: authorizationHeader(accessToken),
  });

export const applyForAccountRequest = (accessToken: string, input: AccountApplicationInput) =>
  send<AccountTerms>(accessToken, "/organisation/billing/account-application", "POST", input);

export const choosePayByCardRequest = (accessToken: string) =>
  send<AccountTerms>(accessToken, "/organisation/billing/payment-type", "PUT", { paymentType: "card" });

export const setDefaultPoNumberRequest = (accessToken: string, poNumber: string | null) =>
  send<AccountTerms>(accessToken, "/organisation/billing/po-number", "PUT", { poNumber });

export const setInvoicePoNumberRequest = (accessToken: string, invoiceId: string, poNumber: string | null) =>
  send<{ invoiceId: string; poNumber: string | null }>(
    accessToken,
    `/organisation/billing/invoices/${invoiceId}/po-number`,
    "PUT",
    { poNumber },
  );

export const validatePromoCodeRequest = (accessToken: string, code: string) =>
  send<PromoPreview>(accessToken, "/organisation/billing/promo-code/validate", "POST", { code });

export const redeemPromoCodeRequest = (accessToken: string, code: string) =>
  send<PromoRedemption>(accessToken, "/organisation/billing/promo-code", "POST", { code });

// ── Platform administrator (platform.manage) ───────────────────────────

export const listAccountApplicationsRequest = (accessToken: string, status?: AccountStatus) =>
  apiRequest<AccountApplication[]>(
    `/admin/billing/account-applications${status ? `?status=${status}` : ""}`,
    { headers: authorizationHeader(accessToken) },
  );

export const approveApplicationRequest = (
  accessToken: string,
  accountId: string,
  input: { termsDays?: number; creditLimitCents?: number | null; notes?: string | null },
) => send<AccountTerms>(accessToken, `/admin/billing/accounts/${accountId}/account-application/approve`, "POST", input);

export const rejectApplicationRequest = (accessToken: string, accountId: string, reason: string) =>
  send<AccountTerms>(accessToken, `/admin/billing/accounts/${accountId}/account-application/reject`, "POST", { reason });

export const holdApplicationRequest = (accessToken: string, accountId: string, reason: string) =>
  send<AccountTerms>(accessToken, `/admin/billing/accounts/${accountId}/account-application/hold`, "POST", { reason });

export const setPaymentTermsRequest = (
  accessToken: string,
  accountId: string,
  input: { paymentType: PaymentType; termsDays?: number; creditLimitCents?: number; poRequired?: boolean; reason: string },
) => send<AccountTerms>(accessToken, `/admin/billing/accounts/${accountId}/payment-terms`, "PUT", input);

export const setCreditLimitRequest = (
  accessToken: string,
  accountId: string,
  creditLimitCents: number | null,
  reason: string,
) => send<AccountTerms>(accessToken, `/admin/billing/accounts/${accountId}/credit-limit`, "PUT", { creditLimitCents, reason });

export const setFreePeriodRequest = (
  accessToken: string,
  accountId: string,
  input: { freeUntil: string; freePercent: number; reason: string },
) => send<AccountTerms>(accessToken, `/admin/billing/accounts/${accountId}/free-period`, "PUT", input);

export const clearFreePeriodRequest = (accessToken: string, accountId: string, reason: string) =>
  send<AccountTerms>(accessToken, `/admin/billing/accounts/${accountId}/free-period/clear`, "POST", { reason });

export const listOverdueRequest = (accessToken: string) =>
  apiRequest<OverdueInvoice[]>("/admin/billing/overdue", { headers: authorizationHeader(accessToken) });

export const markInvoicePaidRequest = (
  accessToken: string,
  invoiceId: string,
  input: { paidOn: string; method: PaymentMethod; reference?: string },
) => send<unknown>(accessToken, `/admin/billing/invoices/${invoiceId}/mark-paid`, "POST", input);

export const listPromoCodesRequest = (accessToken: string) =>
  apiRequest<PromoCode[]>("/admin/billing/promo-codes", { headers: authorizationHeader(accessToken) });

export const createPromoCodeRequest = (accessToken: string, input: PromoCodeTerms & { code: string }) =>
  send<PromoCode>(accessToken, "/admin/billing/promo-codes", "POST", input);

export const updatePromoCodeRequest = (accessToken: string, promoCodeId: string, input: PromoCodeTerms) =>
  send<PromoCode>(accessToken, `/admin/billing/promo-codes/${promoCodeId}`, "PATCH", input);

export const setPromoCodeActiveRequest = (accessToken: string, promoCodeId: string, active: boolean) =>
  send<PromoCode>(accessToken, `/admin/billing/promo-codes/${promoCodeId}/active`, "PUT", { active });

export const listPromoRedemptionsRequest = (accessToken: string, promoCodeId: string) =>
  apiRequest<PromoRedemption[]>(`/admin/billing/promo-codes/${promoCodeId}/redemptions`, {
    headers: authorizationHeader(accessToken),
  });
