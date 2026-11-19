"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { redeemPromoCodeRequest, validatePromoCodeRequest } from "@/lib/api/paymentTermsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatBillingMonth } from "@/lib/format/billingDay";
import type { PromoPreview } from "@/lib/types/paymentTerms";

interface PromoCodeFormProps {
  onRedeemed: () => void;
}

const inputClass = "h-10 w-48 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] uppercase text-ink outline-none";

const describeMonths = (preview: PromoPreview) =>
  preview.endsMonth
    ? `${formatBillingMonth(preview.startsMonth)} to ${formatBillingMonth(preview.endsMonth)}`
    : `from ${formatBillingMonth(preview.startsMonth)}`;

// "Have a promo code?": check a code (the API explains why one can't be
// used: invalid, expired, fully used, new customers only, already used),
// then apply it. It discounts machine charges only.
export const PromoCodeForm = ({ onRedeemed }: PromoCodeFormProps) => {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<PromoPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const run = async (work: () => Promise<void>) => {
    setIsWorking(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(toApiErrorMessage(cause, "Couldn't check that code. Please try again."));
    } finally {
      setIsWorking(false);
    }
  };

  const check = () =>
    run(async () => {
      setPreview(await validatePromoCodeRequest(requireAccessToken(), code.trim()));
    });

  const apply = () =>
    run(async () => {
      await redeemPromoCodeRequest(requireAccessToken(), code.trim());
      setPreview(null);
      setCode("");
      onRedeemed();
    });

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="promo-code" className="text-sm font-medium text-ink">
        Have a promo code?
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="promo-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setPreview(null);
            setError(null);
          }}
          maxLength={40}
          autoComplete="off"
          className={inputClass}
        />
        {preview ? (
          <Button variant="primary" onClick={() => void apply()} disabled={isWorking}>
            {isWorking ? "Applying…" : "Apply code"}
          </Button>
        ) : (
          <Button onClick={() => void check()} disabled={isWorking || code.trim().length === 0}>
            {isWorking ? "Checking…" : "Check code"}
          </Button>
        )}
      </div>
      {preview && (
        <p className="text-sm text-bodyGray">
          <span className="font-medium text-ink">{preview.code}</span>: {preview.summary}, {describeMonths(preview)}.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
