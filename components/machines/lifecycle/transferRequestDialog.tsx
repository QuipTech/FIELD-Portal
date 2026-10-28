"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { requestTransferRequest } from "@/lib/api/machineLifecycleApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";

interface TransferRequestDialogProps {
  machineId: string;
  machineLabel: string;
  onRequested: () => void;
  onClose: () => void;
}

const inputClass = "h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none";

// Sell or transfer (billing spec section 4): the receiving organisation
// must approve. Machine facts move; your work orders, pricing, people and
// notes stay with you.
export const TransferRequestDialog = ({ machineId, machineLabel, onRequested, onClose }: TransferRequestDialogProps) => {
  const [organisationId, setOrganisationId] = useState("");
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      title={`Sell or transfer ${machineLabel}`}
      confirmLabel="Send transfer request"
      confirmVariant="primary"
      isConfirmDisabled={!organisationId.trim() || !reason.trim()}
      onConfirm={async () => {
        await requestTransferRequest(requireAccessToken(), machineId, {
          receivingOrganisationSlug: organisationId.trim(),
          reason: reason.trim(),
        });
        onRequested();
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't send the transfer request. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>
          The receiving organisation must approve. When they do, the machine and its components and configuration move to
          them; your history, work orders, photos, support cases and notes stay with you. Your billing for it stops from the
          1st of next month.
        </p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Receiving organisation ID
          <input value={organisationId} onChange={(event) => setOrganisationId(event.target.value)} maxLength={100} className={inputClass} placeholder="Their administrator finds it under Machines → Transfers" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Reason
          <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className={inputClass} placeholder="e.g. Sold to the new site operator" />
        </label>
      </div>
    </ConfirmDialog>
  );
};
