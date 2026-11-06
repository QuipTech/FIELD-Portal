"use client";

import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";

interface ReasonConfirmDialogProps {
  title: string;
  confirmLabel: string;
  children: ReactNode;
  failedMessage: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

const MIN_REASON_LENGTH = 3;

// A destructive confirmation that needs a reason, kept in the audit log
// (revoking a share, withdrawing a machine from one).
export const ReasonConfirmDialog = ({
  title,
  confirmLabel,
  children,
  failedMessage,
  onConfirm,
  onClose,
}: ReasonConfirmDialogProps) => {
  const [reason, setReason] = useState("");

  return (
    <ConfirmDialog
      title={title}
      confirmLabel={confirmLabel}
      onConfirm={() => onConfirm(reason.trim())}
      onClose={onClose}
      isConfirmDisabled={reason.trim().length < MIN_REASON_LENGTH}
      toErrorMessage={(error) => toApiErrorMessage(error, failedMessage)}
    >
      <div className="flex flex-col gap-2">
        {children}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Contract ended"
            className="rounded-lg border border-borderGrayStrong bg-surface px-3 py-2 text-[15px] text-ink outline-none"
          />
        </label>
      </div>
    </ConfirmDialog>
  );
};
