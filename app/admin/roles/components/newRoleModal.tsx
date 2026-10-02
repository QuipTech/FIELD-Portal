"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";

interface NewRoleModalProps {
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}

const CREATE_FAILED_MESSAGE = "Couldn't create the role. Please try again.";

// Creates the role with no permissions; they're set in the panel after.
export const NewRoleModal = ({ onCreate, onClose }: NewRoleModalProps) => {
  const { can } = usePermissions();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const trimmedName = name.trim();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedName) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await onCreate(trimmedName);
      onClose();
    } catch (error) {
      setCreateError(toApiErrorMessage(error, CREATE_FAILED_MESSAGE));
      setIsCreating(false);
    }
  };

  return (
    <Modal title="New role" onClose={isCreating ? undefined : onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Role name</span>
          <Input
            placeholder="Supervisor"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
            autoFocus
          />
        </div>
        <span className="text-xs text-mutedGray">
          {can(PERMISSIONS.managePlatform)
            ? "This becomes a system role every organisation can use."
            : "This role belongs to your organisation only."}{" "}
          It starts with no permissions. Choose them after it&apos;s created.
        </span>
        {createError && <span className="text-xs text-danger">{createError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={!trimmedName || isCreating}>
            {isCreating ? "Creating…" : "Create role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
