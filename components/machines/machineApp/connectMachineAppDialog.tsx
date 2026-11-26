"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/formField";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { addTabletRequest } from "@/lib/api/machineAppConnectionApi";
import { isFieldId, normaliseFieldId } from "@/lib/types/machineAppConnection";

interface ConnectMachineAppDialogProps {
  machineId: string;
  machineLabel: string;
  // "Continue", once the tablet is on the machine.
  onConnected: () => void;
  onClose: () => void;
}

// Adds a tablet to this machine with the FIELD ID and password it shows.
export const ConnectMachineAppDialog = ({ machineId, machineLabel, onConnected, onClose }: ConnectMachineAppDialogProps) => {
  const [fieldId, setFieldId] = useState("");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await addTabletRequest(machineId, normaliseFieldId(fieldId), password);
      setIsAdded(true);
    } catch (addError) {
      setError(toApiErrorMessage(addError, "Couldn't add the tablet. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title={`Add tablet — ${machineLabel}`} onClose={onClose} widthClassName="w-[460px]">
      {isAdded ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-fillGray text-primary">
            <Icon name="check" className="h-6 w-6" />
          </span>
          <span role="status" className="text-[17px] font-medium text-ink">Tablet added to {machineLabel}</span>
          <p className="text-sm text-bodyGray">It shows as online once the FIELD machine app picks this up.</p>
          <Button variant="primary" className="mt-2" onClick={onConnected}>Continue</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 p-6">
          <p className="text-sm text-bodyGray">
            Enter the FIELD ID and password shown by the FIELD machine app on this machine&apos;s tablet.
          </p>
          <FormField label="FIELD ID">
            <Input value={fieldId} onChange={(event) => setFieldId(event.target.value)} placeholder="482 915 307" inputMode="numeric" autoComplete="off" autoFocus />
          </FormField>
          <FormField label="Password">
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" />
          </FormField>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" disabled={isSaving || !isFieldId(fieldId) || !password}>
            {isSaving ? "Adding…" : "Add tablet"}
          </Button>
        </form>
      )}
    </Modal>
  );
};
