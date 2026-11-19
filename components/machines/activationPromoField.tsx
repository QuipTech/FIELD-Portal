"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { validateActivationPromoRequest } from "@/lib/api/machineLifecycleApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatBillingMonth } from "@/lib/format/billingDay";
import type { ActivationPromoState, AppliedPromo } from "@/lib/hooks/useActivationPromo";

const inputClass = "h-9 w-44 rounded-lg border border-borderGrayStrong bg-surface px-3 text-sm uppercase text-ink outline-none";

const describeMonths = (promo: AppliedPromo) =>
  promo.endsMonth
    ? `${formatBillingMonth(promo.startsMonth)} to ${formatBillingMonth(promo.endsMonth)}`
    : `from ${formatBillingMonth(promo.startsMonth)}`;

// "Have a promo code?" in the activation dialog. A checked code is only
// redeemed when the admin confirms the activation. An organisation has one
// promo at a time, so one already on the account is shown instead.
export const ActivationPromoField = ({ promo }: { promo: ActivationPromoState }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  if (promo.isLoading) return null;

  if (promo.current)
    return (
      <p className="border-t border-borderGray pt-2 text-xs text-bodyGray">
        Promo code <span className="font-medium text-ink">{promo.current.code}</span> is on your account (
        {promo.current.summary}, {describeMonths(promo.current)}), so it&apos;s taken off this charge.
      </p>
    );

  if (promo.pending)
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-borderGray pt-2 text-xs text-bodyGray">
        <span>
          <span className="font-medium text-ink">{promo.pending.code}</span>: {promo.pending.summary},{" "}
          {describeMonths(promo.pending)}. It&apos;s applied when you activate.
        </span>
        <button type="button" className="text-primary underline" onClick={() => promo.setPending(null)}>
          Remove
        </button>
      </div>
    );

  const check = async () => {
    setIsChecking(true);
    setError(null);
    try {
      promo.setPending(await validateActivationPromoRequest(requireAccessToken(), code.trim()));
      setCode("");
    } catch (cause) {
      setError(toApiErrorMessage(cause, "Couldn't check that code. Please try again."));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-borderGray pt-2">
      <label htmlFor="activation-promo-code" className="text-xs font-medium text-ink">
        Have a promo code?
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="activation-promo-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && code.trim()) {
              event.preventDefault();
              void check();
            }
          }}
          maxLength={40}
          autoComplete="off"
          className={inputClass}
        />
        <Button size="sm" onClick={() => void check()} disabled={isChecking || code.trim().length === 0}>
          {isChecking ? "Checking…" : "Apply"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
