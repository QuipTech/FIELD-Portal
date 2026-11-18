"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { applyForAccountRequest } from "@/lib/api/paymentTermsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";

interface AccountApplicationDialogProps {
  onSaved: () => void;
  onClose: () => void;
}

const inputClass = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";
const ABN_PATTERN = /^\d{11}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9 +()-]{8,20}$/;

// Applies for a 30-day account. QuipTech reviews it; nothing is blocked in
// the meantime, and invoices keep the card flow until it's approved.
export const AccountApplicationDialog = ({ onSaved, onClose }: AccountApplicationDialogProps) => {
  const [legalName, setLegalName] = useState("");
  const [abn, setAbn] = useState("");
  const [accountsEmail, setAccountsEmail] = useState("");
  const [accountsPhone, setAccountsPhone] = useState("");
  const [poRequired, setPoRequired] = useState(false);
  const [notes, setNotes] = useState("");
  const abnDigits = abn.replace(/\s+/g, "");
  const isComplete =
    legalName.trim().length > 0 &&
    ABN_PATTERN.test(abnDigits) &&
    EMAIL_PATTERN.test(accountsEmail.trim()) &&
    PHONE_PATTERN.test(accountsPhone.trim());

  return (
    <ConfirmDialog
      title="Apply for a 30-day account"
      confirmLabel="Send application"
      confirmVariant="primary"
      isConfirmDisabled={!isComplete}
      onConfirm={async () => {
        await applyForAccountRequest(requireAccessToken(), {
          legalName: legalName.trim(),
          abn: abnDigits,
          accountsEmail: accountsEmail.trim(),
          accountsPhone: accountsPhone.trim(),
          poRequired,
          notes: notes.trim() || null,
        });
        onSaved();
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't send your application. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>
          With a 30-day account, invoices are emailed to your accounts team to pay by bank transfer. QuipTech reviews each
          application. You can keep using FIELD, adding users and machines while it&apos;s reviewed.
        </p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Legal company name
          <input value={legalName} onChange={(event) => setLegalName(event.target.value)} maxLength={200} className={inputClass} />
        </label>
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-sm text-ink">
            ABN
            <input
              value={abn}
              onChange={(event) => setAbn(event.target.value)}
              inputMode="numeric"
              placeholder="11 digits"
              maxLength={14}
              aria-describedby="abn-error"
              className={inputClass}
            />
          </label>
          {abn && !ABN_PATTERN.test(abnDigits) && (
            <span id="abn-error" className="text-xs text-danger">Enter an 11-digit ABN.</span>
          )}
        </div>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Accounts email
          <input
            type="email"
            value={accountsEmail}
            onChange={(event) => setAccountsEmail(event.target.value)}
            maxLength={254}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Accounts phone
          <input
            type="tel"
            value={accountsPhone}
            onChange={(event) => setAccountsPhone(event.target.value)}
            maxLength={20}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={poRequired} onChange={(event) => setPoRequired(event.target.checked)} />
          Our invoices need a purchase order (PO) number
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            rows={3}
            className="rounded-lg border border-borderGrayStrong bg-surface px-3 py-2 text-[15px] text-ink outline-none"
          />
        </label>
      </div>
    </ConfirmDialog>
  );
};
