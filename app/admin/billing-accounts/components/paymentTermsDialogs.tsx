"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import {
  clearFreePeriodRequest,
  setFreePeriodRequest,
  setPaymentTermsRequest,
} from "@/lib/api/paymentTermsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatBillingDay } from "@/lib/format/billingDay";
import type { OrganisationBilling } from "@/lib/types/billingAccount";
import type { PaymentType } from "@/lib/types/paymentTerms";

interface DialogProps {
  organisation: OrganisationBilling;
  onDone: (message: string) => void;
  onClose: () => void;
}

const inputClass = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";

const ReasonField = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <label className="flex flex-col gap-1 text-sm text-ink">
    Reason (audit log)
    <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={500} className={inputClass} />
  </label>
);

// Switches an organisation between card and a 30-day account at any time.
export const PaymentTermsDialog = ({ organisation, onDone, onClose }: DialogProps) => {
  const accountId = organisation.billingAccount!.id;
  const name = organisation.organisationName;
  const [paymentType, setPaymentType] = useState<PaymentType>(organisation.paymentType === "account" ? "card" : "account");
  const [termsDays, setTermsDays] = useState("30");
  const [creditLimit, setCreditLimit] = useState("");
  const [poRequired, setPoRequired] = useState(false);
  const [reason, setReason] = useState("");
  const days = Number(termsDays);
  const limit = creditLimit.trim() ? Number(creditLimit.replace(/[$,\s]/g, "")) : null;
  const isValid =
    reason.trim().length > 0 &&
    (paymentType === "card" || (Number.isInteger(days) && days >= 1 && days <= 120)) &&
    (limit === null || (Number.isFinite(limit) && limit >= 0));

  return (
    <ConfirmDialog
      title={`How ${name} pays`}
      confirmLabel="Save"
      confirmVariant="primary"
      isConfirmDisabled={!isValid}
      onConfirm={async () => {
        await setPaymentTermsRequest(requireAccessToken(), accountId, {
          paymentType,
          ...(paymentType === "account" && { termsDays: days, poRequired }),
          ...(limit !== null && { creditLimitCents: Math.round(limit * 100) }),
          reason: reason.trim(),
        });
        onDone(paymentType === "account" ? `${name} now pays on a ${days}-day account.` : `${name} now pays by card.`);
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't change how they pay. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>Applies from the next invoice. The organisation&apos;s admins are told. Currently: {organisation.paymentType === "account" ? "30-day account" : "card"}.</p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Pays by
          <select value={paymentType} onChange={(event) => setPaymentType(event.target.value as PaymentType)} className={inputClass}>
            <option value="card">Card (charged automatically)</option>
            <option value="account">30-day account (bank transfer)</option>
          </select>
        </label>
        {paymentType === "account" && (
          <>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Payment terms (days)
              <input value={termsDays} onChange={(event) => setTermsDays(event.target.value)} inputMode="numeric" className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={poRequired} onChange={(event) => setPoRequired(event.target.checked)} />
              Invoices need a PO number
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-sm text-ink">
          Credit limit (A$, optional, leave blank to keep)
          <input value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} inputMode="decimal" className={inputClass} />
        </label>
        <ReasonField value={reason} onChange={setReason} />
      </div>
    </ConfirmDialog>
  );
};

// A free period: machine charges discounted (100% by default) up to and
// including the month containing the date; normal billing after, with no
// back billing.
export const FreePeriodDialog = ({ organisation, onDone, onClose }: DialogProps) => {
  const accountId = organisation.billingAccount!.id;
  const name = organisation.organisationName;
  const current = organisation.freePeriod;
  const [freeUntil, setFreeUntil] = useState(current?.freeUntil ?? "");
  const [percent, setPercent] = useState(String(current?.freePercent ?? 100));
  const [reason, setReason] = useState("");
  const [clearing, setClearing] = useState(false);
  const percentNumber = Number(percent);
  const isValid =
    reason.trim().length > 0 &&
    (clearing || (/^\d{4}-\d{2}-\d{2}$/.test(freeUntil) && Number.isInteger(percentNumber) && percentNumber >= 1 && percentNumber <= 100));

  return (
    <ConfirmDialog
      title={`Free period for ${name}`}
      confirmLabel={clearing ? "End free period" : "Save free period"}
      confirmVariant={clearing ? "danger" : "primary"}
      isConfirmDisabled={!isValid}
      onConfirm={async () => {
        if (clearing) {
          await clearFreePeriodRequest(requireAccessToken(), accountId, reason.trim());
          onDone(`${name}'s free period ended.`);
        } else {
          await setFreePeriodRequest(requireAccessToken(), accountId, {
            freeUntil,
            freePercent: percentNumber,
            reason: reason.trim(),
          });
          onDone(`${name} is ${percentNumber === 100 ? "free" : `${percentNumber}% off`} until ${formatBillingDay(freeUntil)}.`);
        }
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't save the free period. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>
          Machines activate and usage is tracked as normal. Each month up to and including the one containing this date gets a
          discount line on its machine charges; a month that comes to A$0 isn&apos;t sent. Normal billing starts the month after.
        </p>
        {current && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={clearing} onChange={(event) => setClearing(event.target.checked)} />
            End the current free period (until {formatBillingDay(current.freeUntil)})
          </label>
        )}
        {!clearing && (
          <>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Free until
              <input type="date" value={freeUntil} onChange={(event) => setFreeUntil(event.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Percent off machine charges
              <input value={percent} onChange={(event) => setPercent(event.target.value)} inputMode="numeric" className={inputClass} />
            </label>
          </>
        )}
        <ReasonField value={reason} onChange={setReason} />
      </div>
    </ConfirmDialog>
  );
};
