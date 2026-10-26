"use client";

import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { applyBulkLifecycleActionRequest } from "@/lib/api/machineLifecycleApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { LifecycleState } from "@/lib/types/machineLifecycle";
import { ActivationPriceSummary } from "./activationPriceSummary";

export interface BulkActivationMachine {
  id: string;
  lifecycleState: LifecycleState;
}

interface BulkActivateDialogProps {
  machines: BulkActivationMachine[];
  // How many were activated, and the messages for any that weren't.
  onDone: (result: { activated: number; failures: string[] }) => void;
  onClose: () => void;
}

// Activates several machines at once (registered ones are activated,
// archived ones reactivated), showing what they add to this month's bill
// first. Each machine succeeds or fails on its own.
export const BulkActivateDialog = ({ machines, onDone, onClose }: BulkActivateDialogProps) => {
  const count = machines.length;
  const activate = async () => {
    const token = requireAccessToken();
    const groups = [
      { action: "activate" as const, ids: machines.filter((machine) => machine.lifecycleState === "registered").map((machine) => machine.id) },
      { action: "reactivate" as const, ids: machines.filter((machine) => machine.lifecycleState === "archived").map((machine) => machine.id) },
    ].filter((group) => group.ids.length > 0);
    let activated = 0;
    const failures: string[] = [];
    for (const group of groups) {
      const result = await applyBulkLifecycleActionRequest(token, group.ids, group.action);
      activated += result.applied.length;
      failures.push(...result.failed.map((failure) => failure.message));
    }
    onDone({ activated, failures });
  };
  return (
    <ConfirmDialog
      title={`Activate ${count} machine${count === 1 ? "" : "s"}`}
      confirmLabel={`Activate ${count} machine${count === 1 ? "" : "s"}`}
      confirmVariant="primary"
      onConfirm={activate}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't activate the machines. Please try again.")}
    >
      <div className="flex flex-col gap-3">
        <p>
          They count toward this month&apos;s billing from today, and their full history, components, photos, AI and
          support open for everyone in your organisation.
        </p>
        <ActivationPriceSummary count={count} />
      </div>
    </ConfirmDialog>
  );
};
