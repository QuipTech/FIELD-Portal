"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/formField";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { resetTabletPasswordRequest } from "@/lib/api/machineAppConnectionApi";
import { TABLET_PASSWORD_MIN } from "@/lib/types/machineAppConnection";

interface ResetTabletPasswordDialogProps {
  machineId: string;
  machineLabel: string;
  onSaved: () => void;
  onClose: () => void;
}

export const ResetTabletPasswordDialog = ({ machineId, machineLabel, onSaved, onClose }: ResetTabletPasswordDialogProps) => {
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await resetTabletPasswordRequest(machineId, password);
      onSaved();
    } catch (saveError) {
      setError(toApiErrorMessage(saveError, "Couldn't change the password. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal title={`Tablet password — ${machineLabel}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4 p-6">
        <FormField label="New password">
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" autoFocus />
        </FormField>
        <p className="text-xs text-mutedGray">At least {TABLET_PASSWORD_MIN} characters. It replaces the old password at once.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" disabled={isSaving || password.length < TABLET_PASSWORD_MIN}>
          {isSaving ? "Saving…" : "Change password"}
        </Button>
      </form>
    </Modal>
  );
};
