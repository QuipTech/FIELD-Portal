"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { createPromoCodeRequest, updatePromoCodeRequest } from "@/lib/api/paymentTermsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { DiscountType, PromoCode, PromoCodeTerms } from "@/lib/types/paymentTerms";

interface PromoCodeDialogProps {
  // Absent: create a new code.
  promo?: PromoCode;
  onSaved: (message: string) => void;
  onClose: () => void;
}

const inputClass = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";
const CODE_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;

const toWholeNumber = (text: string): number | null => {
  if (!text.trim()) return null;
  const value = Number(text);
  return Number.isInteger(value) && value > 0 ? value : NaN;
};

// Creates or edits a promo code. A redeemed code's discount and length
// can't change (the API refuses), so a customer's deal never moves.
export const PromoCodeDialog = ({ promo, onSaved, onClose }: PromoCodeDialogProps) => {
  const locked = Boolean(promo && promo.redemptionsCount > 0);
  const [code, setCode] = useState(promo?.code ?? "");
  const [description, setDescription] = useState(promo?.description ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(promo?.discountType ?? "percent");
  const [amount, setAmount] = useState(
    promo ? (promo.discountType === "percent" ? String(promo.discountValue) : (promo.discountValue / 100).toFixed(2)) : "",
  );
  const [durationMonths, setDurationMonths] = useState(promo?.durationMonths ? String(promo.durationMonths) : "");
  const [validFrom, setValidFrom] = useState(promo?.validFrom ?? "");
  const [validUntil, setValidUntil] = useState(promo?.validUntil ?? "");
  const [maxRedemptions, setMaxRedemptions] = useState(promo?.maxRedemptions ? String(promo.maxRedemptions) : "");
  const [newCustomersOnly, setNewCustomersOnly] = useState(promo?.newCustomersOnly ?? false);

  const amountNumber = Number(amount.replace(/[$,\s]/g, ""));
  const discountValue =
    discountType === "percent" ? (Number.isInteger(amountNumber) ? amountNumber : NaN) : Math.round(amountNumber * 100);
  const months = toWholeNumber(durationMonths);
  const maxUses = toWholeNumber(maxRedemptions);
  const isValid =
    (promo || CODE_PATTERN.test(code.trim())) &&
    description.trim().length > 0 &&
    Number.isFinite(discountValue) &&
    discountValue > 0 &&
    (discountType !== "percent" || discountValue <= 100) &&
    !Number.isNaN(months) &&
    !Number.isNaN(maxUses) &&
    (!validFrom || !validUntil || validFrom <= validUntil);

  const terms = (): PromoCodeTerms => ({
    description: description.trim(),
    discountType,
    discountValue,
    durationMonths: months,
    validFrom: validFrom || null,
    validUntil: validUntil || null,
    maxRedemptions: maxUses,
    newCustomersOnly,
  });

  return (
    <ConfirmDialog
      title={promo ? `Edit ${promo.code}` : "New promo code"}
      confirmLabel={promo ? "Save changes" : "Create code"}
      confirmVariant="primary"
      isConfirmDisabled={!isValid}
      onConfirm={async () => {
        if (promo) {
          await updatePromoCodeRequest(requireAccessToken(), promo.id, terms());
          onSaved(`${promo.code} saved.`);
        } else {
          const created = await createPromoCodeRequest(requireAccessToken(), { code: code.trim(), ...terms() });
          onSaved(`${created.code} created.`);
        }
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't save the promo code. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>Discounts machine charges only, after any free period, and never below A$0. One active code per organisation.</p>
        {!promo && (
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1 text-sm text-ink">
              Code
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={40}
                aria-describedby="promo-code-hint"
                className={inputClass}
              />
            </label>
            <span id="promo-code-hint" className="text-xs text-bodyGray">
              3–40 letters, numbers, dashes or underscores. Not case-sensitive.
            </span>
          </div>
        )}
        <label className="flex flex-col gap-1 text-sm text-ink">
          Description
          <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} className={inputClass} />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            Discount
            <select
              value={discountType}
              disabled={locked}
              onChange={(event) => setDiscountType(event.target.value as DiscountType)}
              className={inputClass}
            >
              <option value="percent">Percent off</option>
              <option value="fixed_cents">A$ off each month</option>
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            {discountType === "percent" ? "Percent" : "Amount (A$)"}
            <input value={amount} disabled={locked} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-ink">
          For how many months
          <input
            value={durationMonths}
            disabled={locked}
            onChange={(event) => setDurationMonths(event.target.value)}
            inputMode="numeric"
            placeholder="Forever"
            className={inputClass}
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            Valid from
            <input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            Valid until
            <input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Maximum uses
          <input
            value={maxRedemptions}
            onChange={(event) => setMaxRedemptions(event.target.value)}
            inputMode="numeric"
            placeholder="Unlimited"
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={newCustomersOnly} onChange={(event) => setNewCustomersOnly(event.target.checked)} />
          New customers only (nothing invoiced yet)
        </label>
        {locked && <p className="text-xs text-bodyGray">This code has been used, so its discount and length are locked.</p>}
      </div>
    </ConfirmDialog>
  );
};
