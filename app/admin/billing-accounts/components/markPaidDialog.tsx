"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { markInvoicePaidRequest } from "@/lib/api/paymentTermsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { PaymentMethod } from "@/lib/types/paymentTerms";

interface MarkPaidDialogProps {
  invoiceId: string;
  // e.g. "Acme Mining · October 2026 · A$770.00"
  label: string;
  onSaved: () => void;
  onClose: () => void;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

const inputClass = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";

const localToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

// Records a payment that arrived outside Stripe (a 30-day account's bank
// transfer): the Stripe invoice is marked paid out of band, nothing is
// charged, and FIELD shows it paid. Audited.
export const MarkPaidDialog = ({ invoiceId, label, onSaved, onClose }: MarkPaidDialogProps) => {
  const [paidOn, setPaidOn] = useState(localToday());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  return (
    <ConfirmDialog
      title="Mark invoice as paid"
      confirmLabel="Mark as paid"
      confirmVariant="primary"
      isConfirmDisabled={!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)}
      onConfirm={async () => {
        await markInvoicePaidRequest(requireAccessToken(), invoiceId, {
          paidOn,
          method,
          ...(reference.trim() && { reference: reference.trim() }),
        });
        onSaved();
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't mark the invoice as paid. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>
          {label}. Stripe records the invoice as paid outside Stripe; nothing is charged. Reminders stop.
        </p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Date received
          <input type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Method
          <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={inputClass}>
            {METHODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Reference (optional)
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={200}
            placeholder="e.g. bank transaction ID"
            className={inputClass}
          />
        </label>
      </div>
    </ConfirmDialog>
  );
};
