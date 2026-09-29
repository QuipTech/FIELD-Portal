"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { SubscriptionPayload, TenantSubscription } from "@/lib/types/tenantSubscription";
import { BILLING_BASIS_OPTIONS, TIER_OPTIONS } from "../subscriptionLabels";
import { toFormState, toPayload, type SubscriptionFormState } from "../subscriptionForm";

interface SubscriptionEditorModalProps {
  item: TenantSubscription;
  onSave: (tenantId: string, payload: SubscriptionPayload) => Promise<void>;
  onClose: () => void;
}

const SAVE_FAILED_MESSAGE = "Couldn't save the subscription. Please try again.";
const selectClasses = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">{label}</span>
    {children}
  </label>
);

export const SubscriptionEditorModal = ({ item, onSave, onClose }: SubscriptionEditorModalProps) => {
  const [form, setForm] = useState<SubscriptionFormState>(() => toFormState(item));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const update = <K extends keyof SubscriptionFormState>(key: K, value: SubscriptionFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const countInput = (key: "licensedAssets" | "aiMonthlyQueryAllowance" | "wearableSeats" | "remoteExpertSeats") => (
    <Input type="number" min={0} step={1} value={form[key]} onChange={(event) => update(key, event.target.value)} />
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(item.tenantId, toPayload(form));
      onClose();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, SAVE_FAILED_MESSAGE));
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title={`${item.subscription ? "Edit" : "Set up"} subscription — ${item.tenantName}`}
      onClose={isSaving ? undefined : onClose}
      widthClassName="w-[560px]"
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3.5 p-5">
        <Field label="Tier">
          <select
            value={form.tier}
            onChange={(event) => update("tier", event.target.value as SubscriptionFormState["tier"])}
            className={selectClasses}
          >
            {TIER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Billing basis">
          <select
            value={form.billingBasis}
            onChange={(event) => update("billingBasis", event.target.value as SubscriptionFormState["billingBasis"])}
            className={selectClasses}
          >
            <option value="">None (demo only)</option>
            {BILLING_BASIS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {form.billingBasis === "negotiated" && <Field label="Licensed assets">{countInput("licensedAssets")}</Field>}
        <Field label="AI queries / month">{countInput("aiMonthlyQueryAllowance")}</Field>
        <Field label="Starts">
          <Input
            type="date"
            value={form.startsOn}
            onChange={(event) => update("startsOn", event.target.value)}
            required
          />
        </Field>
        <Field label="Ends (blank = no end date)">
          <Input type="date" value={form.endsOn} onChange={(event) => update("endsOn", event.target.value)} />
        </Field>
        <Field label="Wearable seats">{countInput("wearableSeats")}</Field>
        <Field label="Remote expert seats">{countInput("remoteExpertSeats")}</Field>
        <label className="col-span-2 flex items-center gap-2 text-sm text-bodyGray">
          <input
            type="checkbox"
            checked={form.ssoEnabled}
            onChange={(event) => update("ssoEnabled", event.target.checked)}
          />
          Single sign-on (SSO) add-on
        </label>
        <div className="col-span-2">
          <Field label="Notes (optional)">
            <Input value={form.notes} onChange={(event) => update("notes", event.target.value)} maxLength={2000} />
          </Field>
        </div>
        {saveError && <span className="col-span-2 text-xs text-danger">{saveError}</span>}
        <div className="col-span-2 flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save subscription"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
