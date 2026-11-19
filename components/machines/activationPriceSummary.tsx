"use client";

import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { getActivationQuoteRequest } from "@/lib/api/machineLifecycleApi";
import { audMoney } from "@/lib/format/audMoney";
import type { ActivationQuote } from "@/lib/types/machineLifecycle";
import { promoDiscountCents } from "@/lib/types/paymentTerms";
import type { ActivationPromoState } from "@/lib/hooks/useActivationPromo";
import { ActivationPromoField } from "./activationPromoField";

const formatDay = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const describeBand = ({ from, to }: { from: number; to: number | null }) => (to === null ? `${from}+` : `${from}–${to}`);

interface PerMachineSummaryProps {
  quote: Extract<ActivationQuote, { pricing: "per_machine" }>;
  promo?: ActivationPromoState;
}

const PerMachineSummary = ({ quote, promo }: PerMachineSummaryProps) => {
  const applied = promo?.applied ?? null;
  const discountCents = applied ? promoDiscountCents(applied, quote.monthlyAfterCents) : 0;
  const addsNothing = quote.monthlyAfterCents === quote.monthlyBeforeCents;
  const rateDrops = quote.rateBeforeCents !== null && quote.rateAfterCents < quote.rateBeforeCents;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-borderGray bg-surfaceGray p-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-bodyGray">Price per machine</span>
        <span className="font-medium text-ink">{audMoney(quote.rateAfterCents)} / month ex GST</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-bodyGray">Active machines</span>
        <span className="text-ink">{quote.activeToday} → {quote.machinesAfter}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-borderGray pt-2">
        <span className="text-bodyGray">This month&apos;s fleet charge</span>
        <span className="font-medium text-ink">
          {quote.monthlyBeforeCents > 0 && `${audMoney(quote.monthlyBeforeCents)} → `}
          {audMoney(quote.monthlyAfterCents)} ex GST
        </span>
      </div>
      {applied && discountCents > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-bodyGray">Promo {applied.code}</span>
            <span className="font-medium text-primary">−{audMoney(discountCents)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-borderGray pt-2">
            <span className="text-bodyGray">After promo</span>
            <span className="font-medium text-ink">{audMoney(quote.monthlyAfterCents - discountCents)} ex GST</span>
          </div>
        </>
      )}
      {rateDrops && (
        <p className="text-xs text-primary">
          Your fleet moves to the {audMoney(quote.rateAfterCents)} band, so every machine is charged the lower rate.
        </p>
      )}
      {addsNothing && quote.billableBefore > 0 && (
        <p className="text-xs text-bodyGray">
          No extra charge this month: your fleet already reached {plural(quote.billableBefore, "machine")} earlier this month.
        </p>
      )}
      {quote.term === "annual" && quote.committedQty !== null && (
        <p className="text-xs text-bodyGray">
          Your annual plan prepays {plural(quote.committedQty, "machine")}; only machines above that are charged each month.
        </p>
      )}
      <p className="text-xs text-bodyGray">
        No payment is taken now. Machines are billed monthly in arrears: this month&apos;s highest number of active machines
        is invoiced on {formatDay(quote.invoicedOn)}, with GST added
        {applied ? " and the promo taken off (after any free period)" : ""}.
      </p>
      <p className="text-xs text-mutedGray">
        Fleet rates: {quote.bands.map((band) => `${describeBand(band)} machines ${audMoney(band.unitCents)}`).join(" · ")}
      </p>
      {promo && (
        <div className="border-t border-borderGray pt-2">
          <ActivationPromoField promo={promo} />
        </div>
      )}
    </div>
  );
};

// The cost of activating, shown in the activation dialog before the admin
// confirms, with any promo code taken off. A contract has no per-machine
// charge, so there's nothing for a promo to discount.
export const ActivationPriceSummary = ({ count = 1, promo }: { count?: number; promo?: ActivationPromoState }) => {
  const quote = useApiResource((accessToken) => getActivationQuoteRequest(accessToken, count), [count], "Couldn't load pricing.");
  if (quote.isLoading && !quote.data)
    return (
      <span className="flex items-center gap-2 text-sm text-mutedGray">
        <LoadingSpinner /> Loading pricing…
      </span>
    );
  if (quote.error || !quote.data) return <p className="text-sm text-danger">{quote.error ?? "Couldn't load pricing."}</p>;
  if (quote.data.pricing === "contract")
    return (
      <p className="rounded-lg border border-borderGray bg-surfaceGray p-3 text-sm text-bodyGray">
        This machine is covered by your organisation&apos;s contract. No separate per-machine charge applies.
      </p>
    );
  return <PerMachineSummary quote={quote.data} promo={promo} />;
};
