"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { setUserMachineAccessRequest } from "@/lib/api/adminUsersApi";
import type { AdminUser } from "@/lib/types/adminUser";
import type { MachineAccessMode } from "@/lib/types/machineGroup";
import { MachineAccessFields } from "./machineAccessFields";

interface EditMachineAccessModalProps {
  user: AdminUser;
  // Their mode can't change; the shared groups are still listed.
  isAdminRole: boolean;
  onSaved: () => void;
  onClose: () => void;
}

// Users → Machine access: one person's mode, applied from their next page
// load (no sign-out needed), with the shared groups they have.
export const EditMachineAccessModal = ({ user, isAdminRole, onSaved, onClose }: EditMachineAccessModalProps) => {
  const [mode, setMode] = useState<MachineAccessMode>(user.machineAccess?.machineAccessMode ?? "all");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fullName = `${user.firstName} ${user.lastName}`.trim();

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await setUserMachineAccessRequest(
        requireAccessToken(),
        { id: user.id, organisationId: user.organisation.id },
        mode,
      );
      onSaved();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't change their machine access. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal title={`Machine access · ${fullName}`} onClose={isSaving ? undefined : onClose} widthClassName="w-[480px]">
      <div className="flex flex-col gap-3.5 p-5">
        <MachineAccessFields
          mode={mode}
          onChange={setMode}
          isAdminRole={isAdminRole}
          groups={user.machineAccess?.groups ?? []}
          disabled={isSaving}
        />
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={handleSave} disabled={isSaving || isAdminRole}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
