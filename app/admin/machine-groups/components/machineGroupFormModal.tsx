"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import {
  addGroupMachinesRequest,
  createMachineGroupRequest,
  updateMachineGroupRequest,
} from "@/lib/api/adminMachineGroupsApi";
import type { MachineGroup, MachineGroupChanges } from "@/lib/types/machineGroup";
import { MACHINE_GROUP_COLOURS } from "./machineGroupColours";
import { PlatformMachinePicker } from "./platformMachinePicker";
import { toggleId } from "./toggleId";

interface MachineGroupFormModalProps {
  // Null creates a new group.
  group: MachineGroup | null;
  onSaved: (group: MachineGroup) => void;
  onClose: () => void;
}

const toChanges = (group: MachineGroup | null): MachineGroupChanges => ({
  name: group?.name ?? "",
  colour: group?.colour ?? MACHINE_GROUP_COLOURS[0],
  description: group?.description ?? "",
});

// Create or edit a global machine group. A new group can take its first
// machines (from any organisation) straight away; more are added on its
// Machines tab. The API turns a blank description into null; names are
// unique across the platform.
export const MachineGroupFormModal = ({ group, onSaved, onClose }: MachineGroupFormModalProps) => {
  const [changes, setChanges] = useState<MachineGroupChanges>(() => toChanges(group));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [machineIds, setMachineIds] = useState<string[]>([]);
  const [createdGroup, setCreatedGroup] = useState<MachineGroup | null>(null);
  const canSave = changes.name.trim() !== "" && !isSaving;

  const setField = (field: keyof MachineGroupChanges, value: string) =>
    setChanges((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const token = requireAccessToken();
      if (group) return onSaved(await updateMachineGroupRequest(token, group.id, changes));
      // Kept, so retrying after the machines failed doesn't create it twice.
      const created = createdGroup ?? (await createMachineGroupRequest(token, changes));
      setCreatedGroup(created);
      if (machineIds.length) await addGroupMachinesRequest(token, created.id, machineIds);
      onSaved(created);
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't save the group. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title={group ? `Edit ${group.name}` : "New machine group"}
      onClose={isSaving ? undefined : onClose}
      widthClassName={group ? "w-[480px]" : "w-[620px]"}
    >
      <div className="flex flex-col gap-3.5 p-5">
        <FormField label="Name">
          <Input
            value={changes.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="e.g. QuipTech service fleet"
            maxLength={100}
            autoFocus
          />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Colour</span>
          <div className="flex flex-wrap gap-2">
            {MACHINE_GROUP_COLOURS.map((colour) => (
              <button
                key={colour}
                type="button"
                aria-label={`Colour ${colour}`}
                aria-pressed={changes.colour === colour}
                onClick={() => setField("colour", colour)}
                className={`h-7 w-7 rounded-full border-2 ${changes.colour === colour ? "border-ink" : "border-transparent"}`}
                style={{ backgroundColor: colour }}
              />
            ))}
          </div>
        </div>
        <FormField label="Description">
          <textarea
            value={changes.description ?? ""}
            onChange={(event) => setField("description", event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="What these machines have in common, and who looks after them"
            className="rounded-lg border border-borderGrayStrong bg-surface px-3 py-2 text-[15px] text-ink outline-none"
          />
        </FormField>
        {!group && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">
              Machines{machineIds.length ? ` · ${machineIds.length} selected` : " (optional)"}
            </span>
            <PlatformMachinePicker
              selectedIds={machineIds}
              onToggle={(machineId) => setMachineIds((current) => toggleId(current, machineId))}
              disabled={isSaving}
            />
          </div>
        )}
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={handleSave} disabled={!canSave}>
            {isSaving ? "Saving…" : group ? "Save group" : "Create group"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
