import { apiRequest } from "./httpClient";
import type { BillingAccount, NewBillingAccount, OrganisationBilling } from "../types/billingAccount";

// Every organisation's billing account. Platform admin (Owner) only.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const listOrganisationBillingRequest = (accessToken: string) =>
  apiRequest<OrganisationBilling[]>("/admin/billing/organisations", {
    headers: authorizationHeader(accessToken),
  });

export const createBillingAccountRequest = (accessToken: string, account: NewBillingAccount) =>
  apiRequest<BillingAccount>("/admin/billing/accounts", {
    method: "POST",
    headers: authorizationHeader(accessToken),
    body: JSON.stringify(account),
  });
