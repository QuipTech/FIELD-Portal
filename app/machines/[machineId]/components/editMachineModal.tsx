"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/formField";
import { updateMachineDetailsRequest } from "@/lib/api/machineFleetApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { Machine } from "@/lib/types/machine";
import type { MachineDetailsChanges } from "@/lib/types/machineFleet";

interface EditMachineModalProps {
  machine: Machine;
  onSaved: () => void;
  onClose: () => void;
}

// Site and a new hour-meter reading. Only changed fields are sent. Serial and Plant ID have
// their own audited change flow.
export const EditMachineModal = ({ machine, onSaved, onClose }: EditMachineModalProps) => {
  const [site, setSite] = useState(machine.site ?? "");
  const [hours, setHours] = useState(machine.operatingHours === null ? "" : String(machine.operatingHours));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isHoursValid = hours === "" || /^\d+$/.test(hours);

  const collectChanges = (): MachineDetailsChanges => {
    const changes: MachineDetailsChanges = {};
    if (site.trim() !== (machine.site ?? "")) changes.site = site.trim() || null;
    if (hours !== "" && Number(hours) !== machine.operatingHours) changes.operatingHours = Number(hours);
    return changes;
  };

  const handleSave = async () => {
    const changes = collectChanges();
    if (Object.keys(changes).length === 0) return onClose();
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateMachineDetailsRequest(requireAccessToken(), machine.id, changes);
      onSaved();
      onClose();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't save the machine. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Edit machine" onClose={isSaving ? undefined : onClose} widthClassName="w-[480px]">
      <div className="flex flex-col gap-3.5 p-5">
        <div className="flex gap-2.5">
          <FormField className="flex-1" label="Site">
            <Input value={site} onChange={(event) => setSite(event.target.value)} placeholder="e.g. Pit 4" maxLength={100} />
          </FormField>
          <FormField className="flex-1" label="Hours">
            <Input value={hours} onChange={(event) => setHours(event.target.value)} inputMode="numeric" />
          </FormField>
        </div>
        {!isHoursValid && <span className="text-xs text-danger">Hours must be a whole number.</span>}
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={handleSave} disabled={isSaving || !isHoursValid}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
