"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { applyLifecycleActionRequest } from "@/lib/api/machineLifecycleApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { LifecycleChangeResult } from "@/lib/types/machineLifecycle";

type LeavingAction = "deactivate" | "archive";

const COPY: Record<LeavingAction, { title: string; confirm: string; body: string }> = {
  deactivate: {
    title: "Deactivate",
    confirm: "Deactivate machine",
    body: "The machine goes back to registered: it stays in your fleet with its identity and summary, and stops counting toward billing from the 1st of next month. It still counts this month, because a month is billed on its highest number of active machines. Reactivate it whenever you need it again.",
  },
  archive: {
    title: "Archive",
    confirm: "Archive machine",
    body: "Archive a machine you no longer run. Its records are kept, it stops counting toward billing from the 1st of next month, and it still counts this month. You can reactivate it later.",
  },
};

interface LifecycleActionDialogProps {
  machineId: string;
  machineLabel: string;
  action: LeavingAction;
  onDone: (result: LifecycleChangeResult) => void;
  onClose: () => void;
}

// Confirms taking a machine out of active (billing spec section 4), with
// an optional reason for the audit trail.
export const LifecycleActionDialog = ({ machineId, machineLabel, action, onDone, onClose }: LifecycleActionDialogProps) => {
  const [reason, setReason] = useState("");
  const copy = COPY[action];
  return (
    <ConfirmDialog
      title={`${copy.title} ${machineLabel}`}
      confirmLabel={copy.confirm}
      confirmVariant="primary"
      onConfirm={async () => {
        onDone(await applyLifecycleActionRequest(requireAccessToken(), machineId, action, reason.trim() || undefined));
      }}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't change the machine. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>{copy.body}</p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Reason (optional)
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            className="h-10 rounded-lg border border-borderGrayStrong bg-surface px-3 text-[15px] text-ink outline-none"
          />
        </label>
      </div>
    </ConfirmDialog>
  );
};
