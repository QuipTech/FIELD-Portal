"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { deleteMachineRequest, getMachineDeletionCheckRequest } from "@/lib/api/machineLifecycleApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
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
const fieldClasses = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";

const utcDate = (day: string) => new Date(`${day}T00:00:00Z`);
const formatMonth = (day: string) => utcDate(day).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const formatDay = (day: string) => utcDate(day).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Deleting a machine, once it's out of active and its billing is settled. The
// API decides and enforces that; this shows what's still in the way.
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
  const result = check.data;
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
      {result && result.unpaidInvoices.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {result.unpaidInvoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center gap-2 text-bodyGray">
              <span>{formatMonth(invoice.periodStart)} invoice</span>
              {invoice.hostedInvoiceUrl ? (
                <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="font-medium text-primary">
                  Pay invoice
                </a>
              ) : (
                <Link href="/settings/billing" className="font-medium text-primary">
                  View in Billing
                </Link>
              )}
            </li>
          ))}
        </ul>
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
