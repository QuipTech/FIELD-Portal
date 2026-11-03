"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { addGroupMachinesRequest } from "@/lib/api/adminMachineGroupsApi";
import { PlatformMachinePicker } from "../../components/platformMachinePicker";
import { toggleId } from "../../components/toggleId";

interface AddMachinesModalProps {
  groupId: string;
  // Already in the group: shown ticked and disabled.
  existingIds: string[];
  onAdded: (count: number) => void;
  onClose: () => void;
}

const formatAddMachinesLabel = (count: number) =>
  count === 0 ? "Add machines" : `Add ${count} ${count === 1 ? "machine" : "machines"}`;

// Adds the machines ticked from every organisation's, in one go.
export const AddMachinesModal = ({ groupId, existingIds, onAdded, onClose }: AddMachinesModalProps) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await addGroupMachinesRequest(requireAccessToken(), groupId, selected);
      onAdded(selected.length);
    } catch (addError) {
      setError(toApiErrorMessage(addError, "Couldn't add the machines. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Add machines" onClose={isSaving ? undefined : onClose} widthClassName="w-[620px]">
      <div className="flex flex-col gap-3 p-5">
        <PlatformMachinePicker
          selectedIds={selected}
          onToggle={(machineId) => setSelected((current) => toggleId(current, machineId))}
          existingIds={existingIds}
          disabled={isSaving}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={handleAdd} disabled={isSaving || selected.length === 0}>
            {isSaving ? "Adding…" : formatAddMachinesLabel(selected.length)}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
