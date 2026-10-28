"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/formField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { NewBillingAccount, OrganisationBilling } from "@/lib/types/billingAccount";

interface BillingAccountModalProps {
  organisation: OrganisationBilling;
  onCreate: (account: NewBillingAccount) => Promise<void>;
  onClose: () => void;
}

const SAVE_FAILED_MESSAGE = "Couldn't set up the billing account. Please try again.";
const selectClasses = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink";

// Billing days (activation, the monthly peak) are counted in this zone.
const TIMEZONE_OPTIONS = [
  { value: "", label: "Platform default" },
  { value: "Australia/Sydney", label: "Sydney / Melbourne / Canberra" },
  { value: "Australia/Brisbane", label: "Brisbane" },
  { value: "Australia/Adelaide", label: "Adelaide" },
  { value: "Australia/Darwin", label: "Darwin" },
  { value: "Australia/Perth", label: "Perth" },
  { value: "Australia/Hobart", label: "Hobart" },
];

// Creates the organisation's billing account, which lets its admins
// activate machines.
export const BillingAccountModal = ({ organisation, onCreate, onClose }: BillingAccountModalProps) => {
  const [name, setName] = useState(organisation.organisationName);
  const [billingEmail, setBillingEmail] = useState("");
  const [abn, setAbn] = useState("");
  const [timezone, setTimezone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      await onCreate({
        organisationId: organisation.organisationId,
        name: name.trim(),
        billingEmail: billingEmail.trim(),
        abn: abn.trim() || undefined,
        timezone: timezone || undefined,
      });
      onClose();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, SAVE_FAILED_MESSAGE));
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title={`Set up billing — ${organisation.organisationName}`}
      onClose={isSaving ? undefined : onClose}
      widthClassName="w-[480px]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <FormField label="Account name">
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required />
        </FormField>
        <FormField label="Billing email">
          <Input type="email" value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} required />
        </FormField>
        <FormField label="ABN (optional)">
          <Input value={abn} onChange={(event) => setAbn(event.target.value)} placeholder="51 824 753 556" />
        </FormField>
        <FormField label="Time zone">
          <select value={timezone} onChange={(event) => setTimezone(event.target.value)} className={selectClasses}>
            {TIMEZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <p className="text-xs text-mutedGray">
          Once set up, the organisation&apos;s admins can activate machines. A Stripe customer is created now if Stripe
          is configured, otherwise with the first invoice.
        </p>
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={isSaving}>
            {isSaving ? "Saving…" : "Set up billing account"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
