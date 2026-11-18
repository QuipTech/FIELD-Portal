"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { Tag } from "@/components/ui/tag";
import {
  choosePayByCardRequest,
  setDefaultPoNumberRequest,
  setInvoicePoNumberRequest,
} from "@/lib/api/paymentTermsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatBillingDay, formatBillingMonth } from "@/lib/format/billingDay";
import type { OrganisationPaymentTerms } from "@/lib/types/paymentTerms";
import { AccountApplicationDialog } from "./accountApplicationDialog";
import { PromoCodeForm } from "./promoCodeForm";

interface PaymentTermsCardProps {
  terms: OrganisationPaymentTerms;
  onChanged: () => void;
  // Opens Stripe to add or change the card; absent before Stripe is linked.
  onAddCard?: () => void;
}

const inputClass = "h-10 w-56 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";

export const FreePeriodBadge = ({ freePeriod }: { freePeriod: OrganisationPaymentTerms["freePeriod"] }) =>
  freePeriod?.active ? (
    <Tag tone="ok">
      {freePeriod.freePercent === 100 ? "Free" : `${freePeriod.freePercent}% off`} until {formatBillingDay(freePeriod.freeUntil)}
    </Tag>
  ) : null;

const StatusBanner = ({ terms, onAddCard }: Pick<PaymentTermsCardProps, "terms" | "onAddCard">) => {
  if (terms.accountStatus === "pending")
    return (
      <p role="status" className="rounded-lg border border-borderGray bg-surfaceGray p-3 text-sm text-bodyGray">
        Your 30-day account application is with QuipTech for review. Nothing is blocked in the meantime: keep adding users
        and machines. Until it&apos;s approved, invoices are paid by card or emailed with 14-day terms.
      </p>
    );
  if (terms.accountStatus === "on_hold")
    return (
      <p role="status" className="rounded-lg border border-amberBorder bg-amberTint p-3 text-sm text-amber">
        QuipTech needs more information before deciding on your 30-day account. Check your email; nothing is blocked in the
        meantime.
      </p>
    );
  if (terms.accountStatus === "rejected" && !terms.usesAccountTerms)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-dangerBorder bg-dangerTint p-3 text-sm text-danger">
        <span className="flex-1">
          Your 30-day account wasn&apos;t approved{terms.application.rejectedReason ? `: ${terms.application.rejectedReason}` : "."} Please
          add a card so your invoices can be paid.
        </span>
        {onAddCard && (
          <Button size="sm" variant="primary" onClick={onAddCard}>
            Add a card
          </Button>
        )}
      </div>
    );
  return null;
};

const PoNumbers = ({ terms, onChanged }: Pick<PaymentTermsCardProps, "terms" | "onChanged">) => {
  const [standing, setStanding] = useState(terms.defaultPoNumber ?? "");
  const [forInvoice, setForInvoice] = useState(terms.draftInvoice?.poNumber ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async (work: () => Promise<unknown>, done: string) => {
    setMessage(null);
    setError(null);
    try {
      await work();
      setMessage(done);
      onChanged();
    } catch (cause) {
      setError(toApiErrorMessage(cause, "Couldn't save the PO number. Please try again."));
    }
  };
  return (
    <div className="flex flex-col gap-3 border-t border-borderGray pt-3">
      <p className="text-sm text-bodyGray">
        {terms.poRequired
          ? "Your invoices need a purchase order number. Enter one before the invoice is finalised, or it's sent marked “PO number: Not provided”."
          : "Add a purchase order number to your invoices if your accounts team needs one."}
      </p>
      <label className="flex flex-wrap items-center gap-2 text-sm text-ink">
        <span className="w-40">Standing PO number</span>
        <input value={standing} onChange={(event) => setStanding(event.target.value)} maxLength={140} className={inputClass} />
        <Button size="sm" onClick={() => void save(() => setDefaultPoNumberRequest(requireAccessToken(), standing.trim() || null), "Standing PO number saved.")}>
          Save
        </Button>
      </label>
      {terms.draftInvoice && (
        <label className="flex flex-wrap items-center gap-2 text-sm text-ink">
          <span className="w-40">PO for {formatBillingMonth(terms.draftInvoice.periodStart)}</span>
          <input value={forInvoice} onChange={(event) => setForInvoice(event.target.value)} maxLength={140} className={inputClass} />
          <Button
            size="sm"
            onClick={() =>
              void save(
                () => setInvoicePoNumberRequest(requireAccessToken(), terms.draftInvoice!.id, forInvoice.trim() || null),
                "Invoice PO number saved.",
              )
            }
          >
            Save
          </Button>
          {terms.draftInvoice.reviewUntil && (
            <span className="text-xs text-bodyGray">Until {new Date(terms.draftInvoice.reviewUntil).toLocaleString("en-AU")}</span>
          )}
        </label>
      )}
      {message && <p role="status" className="text-sm text-bodyGray">{message}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
};

// How the organisation pays: by card or on a 30-day account, its
// application's progress, any free period, PO numbers and promo code.
export const PaymentTermsCard = ({ terms, onChanged, onAddCard }: PaymentTermsCardProps) => {
  const [isApplying, setIsApplying] = useState(false);
  const [isSwitchingToCard, setIsSwitchingToCard] = useState(false);
  const canApply = ["none", "rejected"].includes(terms.accountStatus) && !terms.usesAccountTerms;
  const showPo = terms.usesAccountTerms || terms.poRequired || Boolean(terms.defaultPoNumber) || terms.accountStatus === "pending";

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borderGray bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium text-ink">How you pay</h2>
        <FreePeriodBadge freePeriod={terms.freePeriod} />
        {terms.usesAccountTerms ? <Tag tone="ok">30-day account</Tag> : <Tag>Card</Tag>}
      </div>

      {terms.usesAccountTerms ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-bodyGray">
            Invoices are emailed{terms.application.accountsEmail ? ` to ${terms.application.accountsEmail}` : ""} with{" "}
            {terms.termsDays} days to pay by bank transfer. Bank details are printed on each invoice. No card is charged.
          </p>
          <Button size="sm" variant="ghost" onClick={() => setIsSwitchingToCard(true)}>
            Pay by card instead
          </Button>
        </div>
      ) : (
        <p className="text-sm text-bodyGray">
          Machines are billed monthly in arrears. Save a card under Payment methods and each invoice is charged automatically;
          otherwise it&apos;s emailed with 14-day terms.
        </p>
      )}

      <StatusBanner terms={terms} onAddCard={onAddCard} />

      {canApply && (
        <div className="flex flex-wrap gap-2">
          {onAddCard && (
            <Button variant="primary" onClick={onAddCard}>
              Pay by card
            </Button>
          )}
          <Button onClick={() => setIsApplying(true)}>Apply for a 30-day account</Button>
        </div>
      )}

      {terms.freePeriod?.active && (
        <p className="text-sm text-bodyGray">
          Your machine charges are {terms.freePeriod.freePercent === 100 ? "free" : `${terms.freePeriod.freePercent}% off`} until{" "}
          {formatBillingDay(terms.freePeriod.freeUntil)}. Normal billing starts the month after.
        </p>
      )}

      {showPo && <PoNumbers key={`${terms.defaultPoNumber}-${terms.draftInvoice?.id}`} terms={terms} onChanged={onChanged} />}

      <div className="border-t border-borderGray pt-3">
        {terms.promo ? (
          <p className="text-sm text-bodyGray">
            Promo code <span className="font-medium text-ink">{terms.promo.code}</span>: {terms.promo.summary}
            {terms.promo.endsMonth
              ? `, ${formatBillingMonth(terms.promo.startsMonth)} to ${formatBillingMonth(terms.promo.endsMonth)}.`
              : `, from ${formatBillingMonth(terms.promo.startsMonth)}.`}
          </p>
        ) : (
          <PromoCodeForm onRedeemed={onChanged} />
        )}
      </div>

      {isApplying && (
        <AccountApplicationDialog
          onSaved={() => {
            setIsApplying(false);
            onChanged();
          }}
          onClose={() => setIsApplying(false)}
        />
      )}
      {isSwitchingToCard && (
        <ConfirmDialog
          title="Pay by card instead?"
          confirmLabel="Switch to card"
          confirmVariant="primary"
          onConfirm={async () => {
            await choosePayByCardRequest(requireAccessToken());
            setIsSwitchingToCard(false);
            onChanged();
          }}
          onClose={() => setIsSwitchingToCard(false)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't switch to card. Please try again.")}
        >
          <p>
            Your next invoices will be charged to the card saved under Payment methods. Moving back to a 30-day account needs
            QuipTech to switch it.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
};
