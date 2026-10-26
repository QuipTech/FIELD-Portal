"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { chooseNextTermRequest, keepPlanRequest } from "@/lib/api/organisationBillingApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { audMoney } from "@/lib/format/audMoney";
import { formatBillingDay } from "@/lib/format/billingDay";
import type { OrganisationBillingSummary, OrganisationPlan } from "@/lib/types/organisationBilling";
import { AnnualSwitchDialog } from "./annualSwitchDialog";
import { CancelPlanDialog } from "./cancelPlanDialog";
import { describeBands } from "./planDescriptions";

interface OrganisationPlanCardProps {
  summary: OrganisationBillingSummary;
  onChanged: () => void;
}

const describeTerm = (plan: OrganisationPlan) =>
  plan.term === "annual"
    ? `Annual prepaid for ${plan.committedQty} machines, ${formatBillingDay(plan.currentPeriodStart)} to ${formatBillingDay(plan.currentPeriodEnd)}`
    : "Monthly, billed in arrears on the 1st. No lock-in.";

// The organisation's plan and the changes it can make itself.
export const OrganisationPlanCard = ({ summary, onChanged }: OrganisationPlanCardProps) => {
  const [dialog, setDialog] = useState<"annual" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plan = summary.plan;
  const isSelfServe = plan?.planCode === "ASSET_PRO";

  const run = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
      onChanged();
    } catch (cause) {
      setError(toApiErrorMessage(cause, "Couldn't save that change. Please try again."));
    }
  };

  if (!plan)
    return (
      <section className="rounded-xl border border-borderGray bg-surface p-5">
        <h2 className="text-lg font-medium text-ink">No plan yet</h2>
        <p className="mt-2 text-sm text-bodyGray">Your plan starts on monthly FIELD Asset Professional when you activate your first machine.</p>
      </section>
    );

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borderGray bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium text-ink">{plan.planName}</h2>
        <Tag tone="primary">{plan.term === "annual" ? "Annual" : "Monthly"}</Tag>
        {plan.status === "cancelling" && plan.cancelAt && <Tag tone="amber">Ends {formatBillingDay(plan.cancelAt)}</Tag>}
      </div>
      <p className="text-sm text-bodyGray">{describeTerm(plan)}</p>
      {isSelfServe && plan.bands.length > 0 && (
        <p className="text-sm text-bodyGray">
          Price per active machine per month, ex GST, for your whole fleet at its size: {describeBands(plan.bands)}
        </p>
      )}
      {plan.planCode === "ENTERPRISE" && <p className="text-sm text-bodyGray">Your Enterprise contract is quoted; contact QuipTech to change it.</p>}
      {plan.nextTerm && plan.status !== "cancelling" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primaryTint px-3 py-2 text-sm text-primaryTintText">
          <span>
            From {formatBillingDay(plan.currentPeriodEnd)}:{" "}
            {plan.nextTerm === "annual" ? `annual prepaid for ${plan.nextCommittedQty} machines` : "monthly billing"}.
          </span>
          <button type="button" className="ml-auto underline" onClick={() => void run(() => chooseNextTermRequest(requireAccessToken(), plan.term === "annual" ? { term: "annual", committedQty: plan.committedQty ?? 1 } : { term: "monthly" }))}>
            Undo
          </button>
        </div>
      )}
      {isSelfServe && (
        <div className="flex flex-wrap gap-2">
          {plan.status === "cancelling" ? (
            <Button variant="primary" onClick={() => void run(() => keepPlanRequest(requireAccessToken()))}>Keep my plan</Button>
          ) : (
            <>
              {plan.term === "monthly" && !plan.nextTerm && (
                <Button variant="primary" onClick={() => setDialog("annual")}>Switch to annual (2 months free)</Button>
              )}
              {plan.term === "annual" && !plan.nextTerm && (
                <Button onClick={() => void run(() => chooseNextTermRequest(requireAccessToken(), { term: "monthly" }))}>
                  Go monthly at renewal
                </Button>
              )}
              <Button variant="ghost" onClick={() => setDialog("cancel")}>Cancel plan</Button>
            </>
          )}
        </div>
      )}
      {plan.status === "cancelling" && plan.exportUntil && (
        <p className="text-xs text-bodyGray">After it ends, your data can be exported until {formatBillingDay(plan.exportUntil)}.</p>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {dialog === "annual" && (
        <AnnualSwitchDialog
          suggestedQty={summary.thisMonth.activeToday}
          startsOn={plan.currentPeriodEnd}
          onSaved={onChanged}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "cancel" && (
        <CancelPlanDialog endsOn={plan.currentPeriodEnd} onSaved={onChanged} onClose={() => setDialog(null)} />
      )}
    </section>
  );
};

// This month so far: machines, the rate and the charge invoiced on the 1st.
export const ThisMonthCard = ({ summary }: { summary: OrganisationBillingSummary }) => {
  const { thisMonth, plan } = summary;
  return (
    <section className="grid grid-cols-1 gap-3 rounded-xl border border-borderGray bg-surface p-5 sm:grid-cols-3">
      <div>
        <p className="text-xs text-mutedGray">Active machines today</p>
        <p className="text-2xl font-medium text-ink">{thisMonth.activeToday}</p>
        <p className="text-xs text-bodyGray">Most this month: {thisMonth.peakSoFar}</p>
      </div>
      <div>
        <p className="text-xs text-mutedGray">Rate per machine</p>
        <p className="text-2xl font-medium text-ink">{thisMonth.rateCents ? audMoney(thisMonth.rateCents) : "—"}</p>
        <p className="text-xs text-bodyGray">per month, ex GST</p>
      </div>
      <div>
        <p className="text-xs text-mutedGray">{plan?.term === "annual" ? "Above your commitment so far" : "This month so far"}</p>
        <p className="text-2xl font-medium text-ink">{audMoney(thisMonth.estimateCents ?? 0)}</p>
        <p className="text-xs text-bodyGray">ex GST · invoiced {formatBillingDay(thisMonth.invoicedOn)}</p>
      </div>
    </section>
  );
};
