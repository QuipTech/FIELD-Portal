"use client";

import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { deleteMachineGroupRequest } from "@/lib/api/adminMachineGroupsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { MachineGroup } from "@/lib/types/machineGroup";

interface DeleteMachineGroupDialogProps {
  group: MachineGroup;
  onDeleted: () => void;
  onClose: () => void;
}

const countOf = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// Says what deleting does before the group goes: its machines stay with
// their organisations, but everyone it was shared with loses them.
export const DeleteMachineGroupDialog = ({ group, onDeleted, onClose }: DeleteMachineGroupDialogProps) => {
  const assignmentCount = group.organisationCount + group.userCount;

  const remove = async () => {
    await deleteMachineGroupRequest(requireAccessToken(), group.id);
    onDeleted();
  };

  return (
    <ConfirmDialog
      title={`Delete ${group.name}?`}
      confirmLabel="Delete group"
      onConfirm={remove}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the group. Please try again.")}
    >
      <div className="flex flex-col gap-2">
        <p>
          {countOf(group.machineCount, "machine", "machines")} and{" "}
          {countOf(assignmentCount, "assignment", "assignments")} are affected.
        </p>
        {assignmentCount > 0 && (
          <p>
            {countOf(group.organisationCount, "organisation", "organisations")} and{" "}
            {countOf(group.userCount, "person", "people")} will stop seeing these machines on their next page load.
          </p>
        )}
        <p>The machines stay with their owners. This can&apos;t be undone.</p>
      </div>
    </ConfirmDialog>
  );
};
