import { apiRequest } from "./httpClient";
import type { PersonalBillingAddress, PersonalBillingStatus, PersonalInvoice } from "../types/personalBilling";

const authorisation = (token: string) => ({ Authorization: `Bearer ${token}` });

export const getPersonalBilling = (token: string) =>
  apiRequest<PersonalBillingStatus>("/me/billing", { headers: authorisation(token) });

export const getPersonalInvoices = (token: string) =>
  apiRequest<PersonalInvoice[]>("/me/billing/invoices", { headers: authorisation(token) });

export const createPersonalPayment = (token: string, address: PersonalBillingAddress) =>
  apiRequest<PersonalBillingStatus & { paymentUrl: string | null }>("/me/billing/payment", {
    method: "POST", headers: authorisation(token), body: JSON.stringify(address),
  });

// Asks Stripe directly, so a payment whose webhook was missed still counts.
export const checkPersonalPayment = (token: string) =>
  apiRequest<PersonalBillingStatus>("/me/billing/payment/check", { method: "POST", headers: authorisation(token) });
