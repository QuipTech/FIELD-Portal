"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/formField";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { correctMachineIdentifiersRequest } from "@/lib/api/machineFleetApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";

export type MachineIdentifier = "plantId" | "serialNumber";

interface EditIdentifierModalProps {
  machineId: string;
  identifier: MachineIdentifier;
  currentValue: string | null;
  onSaved: () => void;
  onClose: () => void;
}

const LABELS: Record<MachineIdentifier, string> = { plantId: "Plant ID", serialNumber: "Serial number" };
const MIN_REASON_LENGTH = 3;

// Corrects the Plant ID or serial. These identify the machine, so each change
// says why and is audited; the machine's own id never changes. The serial
// can't be blank; a blank Plant ID clears it.
export const EditIdentifierModal = ({ machineId, identifier, currentValue, onSaved, onClose }: EditIdentifierModalProps) => {
  const [value, setValue] = useState(currentValue ?? "");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = LABELS[identifier];
  const trimmed = value.trim();
  const isUnchanged = trimmed === (currentValue ?? "");
  const isBlankSerial = identifier === "serialNumber" && trimmed === "";
  const canSave = !isUnchanged && !isBlankSerial && reason.trim().length >= MIN_REASON_LENGTH;

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await correctMachineIdentifiersRequest(requireAccessToken(), machineId, {
        ...(identifier === "serialNumber" ? { serialNumber: trimmed } : { assetNumber: trimmed || null }),
        reason: reason.trim(),
      });
      onSaved();
      onClose();
    } catch (saveError) {
      setError(toApiErrorMessage(saveError, `Couldn't save the ${label.toLowerCase()}. Please try again.`));
      setIsSaving(false);
    }
  };

  return (
    <Modal title={`Edit ${label.toLowerCase()}`} onClose={isSaving ? undefined : onClose} widthClassName="w-[480px]">
      <div className="flex flex-col gap-3.5 p-5">
        <FormField label={label}>
          <Input value={value} onChange={(event) => setValue(event.target.value)} maxLength={100} autoFocus className="font-mono" />
        </FormField>
        {isBlankSerial && <span className="text-xs text-danger">The serial number can&apos;t be blank.</span>}
        <FormField label="Reason for the change">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="e.g. Typo when registering" />
        </FormField>
        <p className="text-xs text-mutedGray">The change and its reason are kept in the machine&apos;s audit record.</p>
        {error && <span className="text-xs text-danger">{error}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={save} disabled={isSaving || !canSave}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
