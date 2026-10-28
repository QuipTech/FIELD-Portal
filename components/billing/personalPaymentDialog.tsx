"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { LogoutButton } from "../shell/logoutButton";
import { checkPersonalPayment, createPersonalPayment } from "@/lib/api/personalBillingApi";
import { getAccessToken } from "@/lib/auth/authSession";
import { audMoney } from "@/lib/format/audMoney";
import type { PersonalBillingStatus } from "@/lib/types/personalBilling";

// Checkout for new payments; the hosted invoice page for invoices sent to Stripe earlier.
const stripePaymentHosts = ["checkout.stripe.com", "invoice.stripe.com"];

interface PersonalPaymentDialogProps {
  status: PersonalBillingStatus;
  refresh: () => Promise<void>;
  onClose?: () => void;
}

export const PersonalPaymentDialog = ({ status, refresh, onClose }: PersonalPaymentDialogProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    form.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => previous?.focus();
  }, []);
  const checkPayment = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      await checkPersonalPayment(token);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to check your payment. Please try again.");
    }
  }, [refresh]);
  useEffect(() => {
    // Returning from a payment started earlier: confirm it with Stripe straight away.
    if (status.hostedInvoiceUrl) void checkPayment();
    // Coming Back from Stripe restores this page from the back/forward cache with the button still busy.
    const resetAfterReturn = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setBusy(false);
      void checkPayment();
    };
    window.addEventListener("pageshow", resetAfterReturn);
    return () => window.removeEventListener("pageshow", resetAfterReturn);
    // Only on opening; usePersonalBilling keeps polling after that.
  }, []);
  const trapFocus = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape" && onClose) { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const controls = form.current?.closest("[role=dialog]")?.querySelectorAll<HTMLElement>("input:not(:disabled), select:not(:disabled), button:not(:disabled), a[href]");
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const token = getAccessToken();
    if (!token) { setError("Please sign in again to continue."); return; }
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    let redirecting = false;
    try {
      const result = await createPersonalPayment(token, {
        line1: String(values.get("line1")).trim(), city: String(values.get("city")).trim(),
        state: String(values.get("state")), postalCode: String(values.get("postalCode")).trim(),
        // Stripe Checkout returns here after payment; the API accepts only portal origins.
        returnOrigin: window.location.origin,
      });
      if (result.paymentUrl) {
        const url = new URL(result.paymentUrl);
        if (url.protocol !== "https:" || !stripePaymentHosts.includes(url.hostname))
          throw new Error("The payment link could not be verified. Please contact support.");
        // Same tab: Stripe Checkout sends the user back to the portal once they have paid.
        redirecting = true;
        window.location.assign(url.href);
        return;
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open payment. Please try again.");
    } finally { if (!redirecting) setBusy(false); }
  };

  const inputClass = "w-full rounded-lg border border-borderGrayStrong bg-surface px-3 py-2 text-ink";
  return (
    <Modal title="Activate your FIELD subscription" onClose={onClose} widthClassName="w-[520px]">
      <form ref={form} onSubmit={submit} onKeyDown={trapFocus} className="flex flex-col gap-4 p-5">
        <div>
          <p className="text-[26px] font-medium text-ink">{audMoney(status.monthlyCents)}<span className="text-sm font-normal text-bodyGray"> / month ex GST</span></p>
          <p className="mt-2 text-sm text-bodyGray">Every non-owner needs a paid FIELD Technician subscription, including members of an organisation that already pays.</p>
        </div>
        <p className="text-sm text-bodyGray">This payment covers {status.periodStart} through the day before {status.periodEnd} ({status.timezone}). The full monthly amount applies, with no trial or proration. A new payment is due next calendar month.</p>
        <fieldset className="flex flex-col gap-3" disabled={busy}>
          <legend className="mb-2 text-sm font-medium text-ink">Australian billing address</legend>
          <label className="text-sm text-bodyGray">Street address<input name="line1" required maxLength={200} autoComplete="address-line1" className={inputClass} /></label>
          <label className="text-sm text-bodyGray">City / suburb<input name="city" required maxLength={100} autoComplete="address-level2" className={inputClass} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-bodyGray">State<select name="state" required defaultValue="QLD" autoComplete="address-level1" className={inputClass}>
              {["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].map((state) => <option key={state}>{state}</option>)}
            </select></label>
            <label className="text-sm text-bodyGray">Postcode<input name="postalCode" required pattern="[0-9]{4}" maxLength={4} inputMode="numeric" autoComplete="postal-code" className={inputClass} /></label>
          </div>
        </fieldset>
        <p className="text-xs text-bodyGray">GST is added by Stripe. Card details stay with Stripe. This payment does not enable automatic monthly charges.</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Opening secure Stripe payment…" : `Confirm ${audMoney(status.monthlyCents)} ex GST and pay`}</Button>
        <div className="flex items-center justify-between">
          <Button type="button" onClick={() => void checkPayment()} disabled={busy}>I’ve paid — check status</Button>
          <LogoutButton className="flex items-center gap-2 text-sm text-bodyGray" />
        </div>
        <Link href="/settings/billing" className="text-center text-sm text-primary underline" onClick={onClose}>View billing and invoices</Link>
      </form>
    </Modal>
  );
};
