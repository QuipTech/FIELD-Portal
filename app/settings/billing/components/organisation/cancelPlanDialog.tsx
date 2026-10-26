"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { cancelPlanRequest } from "@/lib/api/organisationBillingApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatBillingDay } from "@/lib/format/billingDay";

interface CancelPlanDialogProps {
  endsOn: string;
  onSaved: () => void;
  onClose: () => void;
}

// Ends the plan at the end of the current term; it can be kept until then.
export const CancelPlanDialog = ({ endsOn, onSaved, onClose }: CancelPlanDialogProps) => {
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      title="Cancel your FIELD plan"
      confirmLabel="Cancel at end of term"
      isConfirmDisabled={reason.trim().length === 0}
      onConfirm={async () => {
        await cancelPlanRequest(requireAccessToken(), reason.trim());
        onSaved();
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't cancel the plan. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>
          Your plan keeps running until {formatBillingDay(endsOn)} and this term is billed as usual. After that,
          full machine history, adding machines and new AI sessions stop. Your data stays available to export for 30
          days. You can keep the plan any time before it ends.
        </p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Why are you cancelling?
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            className="rounded-lg border border-borderGrayStrong bg-surface px-3 py-2 text-[15px] text-ink outline-none"
          />
        </label>
      </div>
    </ConfirmDialog>
  );
};
