"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { deleteMachineRequest, getMachineDeletionCheckRequest, payMachineFinalChargeRequest } from "@/lib/api/machineLifecycleApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { audMoney } from "@/lib/format/audMoney";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { machineKeyPrefix } from "@/lib/machineDetail/machineDetailCacheKeys";
import { invalidateCached } from "@/lib/machineDetail/resourceCache";
import type { LifecycleState } from "@/lib/types/machineLifecycle";

interface DeleteMachineSectionProps {
  machineId: string;
  machineLabel: string;
  lifecycleState: LifecycleState;
}

const MIN_REASON_LENGTH = 3;
const STRIPE_PAYMENT_HOSTS = ["checkout.stripe.com", "invoice.stripe.com"];
const UNVERIFIED_LINK_MESSAGE = "The payment link could not be verified. Please contact support.";
const fieldClasses = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";

const utcDate = (day: string) => new Date(`${day}T00:00:00Z`);
const formatMonth = (day: string) => utcDate(day).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const formatDay = (day: string) => utcDate(day).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Deleting a machine: deactivate it, pay what's billed and the days used since
// the last invoice, then delete. The API decides and enforces that; this shows
// the next step.
export const DeleteMachineSection = ({ machineId, machineLabel, lifecycleState }: DeleteMachineSectionProps) => {
  const router = useRouter();
  const check = useApiResource(
    (accessToken) => getMachineDeletionCheckRequest(accessToken, machineId),
    [machineId, lifecycleState],
    "Couldn't check whether this machine can be deleted.",
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [typedLabel, setTypedLabel] = useState("");
  const [reason, setReason] = useState("");
  const [isRaisingCharge, setIsRaisingCharge] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [isChoosingBankTransfer, setIsChoosingBankTransfer] = useState(false);
  const result = check.data;
  const finalCharge = result?.finalCharge ?? null;
  const isAwaitingPayment = result?.blocker === "unpaid_invoices";
  const { reload } = check;

  // Invoices are paid in another tab, so look again on coming back to this one.
  useEffect(() => {
    if (!isAwaitingPayment) return;
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [isAwaitingPayment, reload]);

  // Raises the invoice for the total due and goes to Stripe Checkout, which
  // takes the billing address, adds GST and comes back here once paid.
  const raiseFinalCharge = async () => {
    setIsRaisingCharge(true);
    setChargeError(null);
    let isRedirecting = false;
    try {
      const next = await payMachineFinalChargeRequest(requireAccessToken(), machineId, window.location.origin);
      if (next.paymentUrl) {
        const url = new URL(next.paymentUrl);
        if (url.protocol !== "https:" || !STRIPE_PAYMENT_HOSTS.includes(url.hostname)) throw new Error(UNVERIFIED_LINK_MESSAGE);
        isRedirecting = true;
        window.location.assign(url.href);
        return;
      }
      check.reload();
    } catch (error) {
      setChargeError(error instanceof Error && error.message === UNVERIFIED_LINK_MESSAGE ? UNVERIFIED_LINK_MESSAGE : toApiErrorMessage(error, "Couldn't open the payment. Please try again."));
    } finally {
      if (!isRedirecting) setIsRaisingCharge(false);
    }
  };
  // Emails the invoice with the bank details; the machine can be deleted
  // once an administrator confirms the money arrived.
  const payByBankTransfer = async () => {
    const next = await payMachineFinalChargeRequest(requireAccessToken(), machineId, window.location.origin, "bank_transfer");
    check.setData(next);
    setIsChoosingBankTransfer(false);
  };
  const canPayByBankTransfer = Boolean(result?.bankTransferAvailable);
  // A promo or free period covers it all: settling records it, no payment.
  const isFullyDiscounted = finalCharge !== null && finalCharge.amountDueCents === 0;
  const bankTransfer = result?.bankTransfer ?? null;
  const canConfirm = typedLabel.trim() === machineLabel && reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <div className="flex flex-col gap-2 border-t border-borderGray pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-ink">Delete machine</span>
          {check.error && <span className="text-sm text-danger">{check.error}</span>}
          {result?.message && <span className="text-sm text-bodyGray">{result.message}</span>}
          {result?.finalInvoiceFrom && <span className="text-xs text-mutedGray">The final invoice is issued from {formatDay(result.finalInvoiceFrom)}.</span>}
          {result?.canDelete && <span className="text-sm text-bodyGray">Billing is settled. This machine can be deleted.</span>}
        </div>
        <Button size="sm" variant="danger" className="ml-auto" disabled={!result?.canDelete} onClick={() => setIsConfirming(true)}>
          Delete machine
        </Button>
      </div>
      {finalCharge && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-fillGray p-3 text-sm">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium text-ink">Amount due: {audMoney(finalCharge.amountDueCents)} + GST</span>
            {finalCharge.months.map((month) => (
              <span key={month.periodStart} className="text-bodyGray">
                {formatMonth(month.periodStart)}: {month.daysUsed} of {month.daysInMonth} days, up to {formatDay(month.lastUsedOn)}, at {audMoney(month.monthlyRateCents)} a month: {audMoney(month.amountCents)}
              </span>
            ))}
            {finalCharge.discounts.map((discount) => (
              <span key={discount.description} className="text-primary">
                {discount.description}: −{audMoney(-discount.amountCents)}
              </span>
            ))}
            <span className="text-xs text-mutedGray">This machine then comes off the monthly invoice for these months, and can&apos;t be reactivated this month. You delete it once this is paid.</span>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {canPayByBankTransfer && !isFullyDiscounted && (
              <Button size="sm" disabled={isRaisingCharge} onClick={() => setIsChoosingBankTransfer(true)}>
                Pay by bank transfer
              </Button>
            )}
            <Button size="sm" variant="primary" disabled={isRaisingCharge} onClick={raiseFinalCharge}>
              {isRaisingCharge ? "Creating invoice…" : isFullyDiscounted ? "Settle (nothing to pay)" : "Pay online"}
            </Button>
          </div>
        </div>
      )}
      {bankTransfer && (
        <div className="flex flex-col gap-1 rounded-lg bg-fillGray p-3 text-sm">
          <span className="font-medium text-ink">Pay by bank transfer</span>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-0.5 text-bodyGray">
            {bankTransfer.accountName && (
              <>
                <dt>Account name</dt>
                <dd className="text-ink">{bankTransfer.accountName}</dd>
              </>
            )}
            <dt>BSB</dt>
            <dd className="text-ink">{bankTransfer.bsb}</dd>
            <dt>Account number</dt>
            <dd className="text-ink">{bankTransfer.accountNumber}</dd>
            {bankTransfer.reference && (
              <>
                <dt>Reference</dt>
                <dd className="font-medium text-ink">{bankTransfer.reference}</dd>
              </>
            )}
          </dl>
          <span className="text-xs text-mutedGray">
            Use the reference so we can match your payment. The invoice, with GST, has been emailed to your billing contact.
            Once you&apos;ve paid, let our accounts team know (contact your administrator or QuipTech support). As soon as we
            confirm the payment, you can delete this machine.
          </span>
        </div>
      )}
      {chargeError && <span className="text-sm text-danger">{chargeError}</span>}
      {result && result.unpaidInvoices.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {result.unpaidInvoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center gap-2 text-bodyGray">
              <span>{invoice.isFinalCharge ? `Final charge from ${formatMonth(invoice.periodStart)}` : `${formatMonth(invoice.periodStart)} invoice`}</span>
              {invoice.payByBankTransfer ? (
                <>
                  <Tag tone="amber">Bank transfer awaiting approval</Tag>
                  {invoice.hostedInvoiceUrl && (
                    <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="font-medium text-primary">
                      View invoice
                    </a>
                  )}
                </>
              ) : invoice.hostedInvoiceUrl ? (
                <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="font-medium text-primary">
                  Pay invoice
                </a>
              ) : invoice.isFinalCharge ? (
                <>
                  <Button size="sm" variant="primary" disabled={isRaisingCharge} onClick={raiseFinalCharge}>
                    {isRaisingCharge ? "Creating invoice…" : "Pay online"}
                  </Button>
                  {canPayByBankTransfer && (
                    <Button size="sm" disabled={isRaisingCharge} onClick={() => setIsChoosingBankTransfer(true)}>
                      Pay by bank transfer
                    </Button>
                  )}
                </>
              ) : (
                <Link href="/settings/billing" className="font-medium text-primary">
                  View in Billing
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {isChoosingBankTransfer && (
        <ConfirmDialog
          title="Pay by bank transfer?"
          confirmLabel="Email invoice"
          confirmVariant="primary"
          onConfirm={payByBankTransfer}
          onClose={() => setIsChoosingBankTransfer(false)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't set up the bank transfer. Please try again.")}
        >
          <p>
            We&apos;ll email the invoice{finalCharge ? ` for ${audMoney(finalCharge.amountDueCents)} + GST` : ""} to your billing
            contact, with our bank details and a payment reference. Once we&apos;ve confirmed the payment, you can delete{" "}
            {machineLabel}. To pay by card instead, use Pay online.
          </p>
        </ConfirmDialog>
      )}
      {isConfirming && (
        <ConfirmDialog
          title={`Delete ${machineLabel}?`}
          confirmLabel="Delete machine"
          isConfirmDisabled={!canConfirm}
          onConfirm={async () => {
            await deleteMachineRequest(requireAccessToken(), machineId, reason.trim());
            invalidateCached(machineKeyPrefix(machineId));
            router.push("/machines");
          }}
          onClose={() => setIsConfirming(false)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the machine. Please try again.")}
        >
          <div className="flex flex-col gap-3">
            <p>
              It disappears from your fleet and from everyone it&apos;s shared with, and any connected machine app is disconnected. Past invoices and audit records are kept. You can&apos;t undo this yourself.
            </p>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Type {machineLabel} to confirm
              <input aria-label="Machine name" value={typedLabel} onChange={(event) => setTypedLabel(event.target.value)} className={fieldClasses} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Reason
              <input aria-label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className={fieldClasses} />
            </label>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
};
