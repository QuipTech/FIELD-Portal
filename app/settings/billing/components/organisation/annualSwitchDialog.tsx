"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { chooseNextTermRequest, getAnnualQuoteRequest } from "@/lib/api/organisationBillingApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { audMoney } from "@/lib/format/audMoney";
import { formatBillingDay } from "@/lib/format/billingDay";
import type { AnnualQuote } from "@/lib/types/organisationBilling";

interface AnnualSwitchDialogProps {
  // Suggested commitment: the machines active today.
  suggestedQty: number;
  startsOn: string;
  onSaved: () => void;
  onClose: () => void;
}

const QUOTE_DELAY_MS = 300;

// Annual prepaid (billing spec section 3): commit to Q machines and pay
// price(Q) × 10 up front for 12 months, from the next renewal. Months with
// more machines than Q add only the difference.
export const AnnualSwitchDialog = ({ suggestedQty, startsOn, onSaved, onClose }: AnnualSwitchDialogProps) => {
  const [qtyText, setQtyText] = useState(String(Math.max(suggestedQty, 1)));
  const [quote, setQuote] = useState<AnnualQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const qty = Number(qtyText);
  const isValid = Number.isInteger(qty) && qty >= 1 && qty <= 100000;

  useEffect(() => {
    if (!isValid) { setQuote(null); return; }
    let live = true;
    const timer = window.setTimeout(() => {
      getAnnualQuoteRequest(requireAccessToken(), qty)
        .then((result) => { if (live) { setQuote(result); setQuoteError(null); } })
        .catch((error) => { if (live) setQuoteError(toApiErrorMessage(error, "Couldn't price that commitment.")); });
    }, QUOTE_DELAY_MS);
    return () => { live = false; window.clearTimeout(timer); };
  }, [qty, isValid]);

  return (
    <ConfirmDialog
      title="Switch to annual prepaid"
      confirmLabel="Switch at renewal"
      confirmVariant="primary"
      isConfirmDisabled={!isValid || !quote}
      onConfirm={async () => {
        await chooseNextTermRequest(requireAccessToken(), { term: "annual", committedQty: qty });
        onSaved();
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't save your choice. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>
          Commit to a number of machines for 12 months from {formatBillingDay(startsOn)} and pay for 10 of them up front:
          two months free. In a month with more active machines than you committed to, only the difference is added.
          There is no refund for months below it.
        </p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Machines to commit to
          <Input type="number" min={1} value={qtyText} onChange={(event) => setQtyText(event.target.value)} aria-label="Machines to commit to" />
        </label>
        {quoteError && <p className="text-sm text-danger">{quoteError}</p>}
        {isValid && !quote && !quoteError && (
          <span className="flex items-center gap-2 text-sm text-mutedGray"><LoadingSpinner /> Pricing…</span>
        )}
        {quote && (
          <div className="rounded-lg border border-borderGray bg-surfaceGray p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-bodyGray">{quote.committedQty} machines a month</span>
              <span className="text-ink">{audMoney(quote.monthlyPriceCents)} ex GST</span>
            </div>
            <div className="mt-1 flex justify-between gap-3 border-t border-borderGray pt-1">
              <span className="text-bodyGray">Up front for 12 months ({quote.monthsCharged} charged)</span>
              <span className="font-medium text-ink">{audMoney(quote.upFrontCents)} ex GST</span>
            </div>
            <p className="mt-2 text-xs text-bodyGray">Invoiced on {formatBillingDay(startsOn)}, with GST added. Until then you stay on monthly billing.</p>
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
};
