"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useApiResource } from "@/lib/hooks/useApiResource";
import {
  createOrganisationPortalSessionRequest,
  getOrganisationBillingRequest,
  listOrganisationInvoicesRequest,
} from "@/lib/api/organisationBillingApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { audMoney } from "@/lib/format/audMoney";
import { formatBillingDay } from "@/lib/format/billingDay";
import { AllowanceUsageCard } from "./allowanceUsageCard";
import { OrganisationInvoicesCard } from "./organisationInvoicesCard";
import { OrganisationPlanCard, ThisMonthCard } from "./organisationPlanCard";

// The organisation's billing (billing.manage): plan, this month, payment
// state, fair use and invoices. Machines are billed monthly in arrears; a
// card or direct debit saved in Stripe is charged automatically.
export const OrganisationBillingView = () => {
  const summary = useApiResource(getOrganisationBillingRequest, [], "Couldn't load your organisation's billing.");
  const invoices = useApiResource(listOrganisationInvoicesRequest, [], "Couldn't load invoices.");
  const [portalError, setPortalError] = useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const reload = () => { summary.reload(); invoices.reload(); };

  const openPaymentMethods = async () => {
    setIsOpeningPortal(true);
    setPortalError(null);
    try {
      const { url } = await createOrganisationPortalSessionRequest(requireAccessToken());
      window.location.assign(url);
    } catch (cause) {
      setPortalError(toApiErrorMessage(cause, "Couldn't open payment methods. Please try again."));
      setIsOpeningPortal(false);
    }
  };

  if (summary.isLoading && !summary.data)
    return <span className="flex items-center gap-2 p-6 text-sm text-mutedGray"><LoadingSpinner /> Loading organisation billing…</span>;
  if (summary.error) return <p className="rounded-xl border border-borderGray bg-surface p-5 text-sm text-bodyGray">{summary.error}</p>;
  if (!summary.data) return null;
  const { account, overdue } = summary.data;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-medium text-ink">{account.name}</h2>
        <span className="text-sm text-bodyGray">Invoices go to {account.billingEmail}</span>
        <Button className="ml-auto" onClick={() => void openPaymentMethods()} disabled={isOpeningPortal || !account.hasStripeCustomer}>
          {isOpeningPortal ? "Opening Stripe…" : "Payment methods"}
        </Button>
      </div>
      {portalError && <p role="alert" className="text-sm text-danger">{portalError}</p>}
      {account.suspendedAt && (
        <div role="alert" className="rounded-xl border border-dangerBorder bg-dangerTint p-4 text-sm text-danger">
          New machine activations and new AI sessions are paused until your overdue invoices are paid. Work already under
          way continues, and all your records stay available.
        </div>
      )}
      {!account.suspendedAt && overdue.count > 0 && (
        <div role="alert" className="rounded-xl border border-amberBorder bg-amberTint p-4 text-sm text-amber">
          {overdue.count} invoice{overdue.count === 1 ? " is" : "s are"} overdue ({audMoney(overdue.amountCents)}).
          {overdue.suspensionFrom && ` If unpaid, new activations and AI sessions may be paused from ${formatBillingDay(overdue.suspensionFrom)}.`}
        </div>
      )}
      <OrganisationPlanCard summary={summary.data} onChanged={reload} />
      <ThisMonthCard summary={summary.data} />
      <AllowanceUsageCard allowance={summary.data.allowance} />
      {invoices.data && <OrganisationInvoicesCard invoices={invoices.data} />}
      {invoices.error && <p className="text-sm text-danger">{invoices.error}</p>}
      <p className="px-1 text-xs text-bodyGray">
        Save a card or direct debit under Payment methods and invoices are paid automatically; otherwise they are emailed with
        14-day terms.
      </p>
    </div>
  );
};
