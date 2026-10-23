"use client";

import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { applyLifecycleActionRequest } from "@/lib/api/machineLifecycleApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { LifecycleChangeResult, LifecycleState } from "@/lib/types/machineLifecycle";

interface ActivateMachineDialogProps {
  machineId: string;
  machineLabel: string;
  lifecycleState: LifecycleState;
  onActivated: (result: LifecycleChangeResult) => void;
  onClose: () => void;
}

const ACTIVATE_FAILED_MESSAGE = "Couldn't activate the machine. Please try again.";

// A registered machine is activated; an archived one reactivated. Both
// start billing for it from today.
export const activationActionFor = (state: LifecycleState) =>
  state === "registered" ? "activate" : state === "archived" ? "reactivate" : null;

// Confirms and applies activation. Used from the machine page and the
// Machines list.
export const ActivateMachineDialog = ({
  machineId,
  machineLabel,
  lifecycleState,
  onActivated,
  onClose,
}: ActivateMachineDialogProps) => {
  const action = activationActionFor(lifecycleState);
  const verb = action === "reactivate" ? "Reactivate" : "Activate";

  const activate = async () => {
    if (!action) return;
    onActivated(await applyLifecycleActionRequest(requireAccessToken(), machineId, action));
  };

  return (
    <ConfirmDialog
      title={`${verb} ${machineLabel}`}
      confirmLabel={`${verb} machine`}
      confirmVariant="primary"
      onConfirm={activate}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, ACTIVATE_FAILED_MESSAGE)}
    >
      The machine counts toward this month&apos;s billing from today. Its full history, components, photos, AI and
      support then open for everyone in your organisation, in the portal and the mobile app.
    </ConfirmDialog>
  );
};
