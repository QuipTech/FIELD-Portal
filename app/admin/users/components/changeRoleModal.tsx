"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/selectInput";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { changeUserRoleRequest } from "@/lib/api/adminUsersApi";
import type { AdminRole } from "@/lib/types/adminRole";
import type { AdminUser } from "@/lib/types/adminUser";
import { assignableRoles, describeRoleOption } from "../assignableRoles";

interface ChangeRoleModalProps {
  user: AdminUser;
  roles: AdminRole[];
  onChanged: () => void;
  onClose: () => void;
}


// One role per user: the choice replaces whatever they hold now.
export const ChangeRoleModal = ({ user, roles, onChanged, onClose }: ChangeRoleModalProps) => {
  const options = assignableRoles(roles, user.organisation.id);
  const currentRoleId = options.find((role) => user.roles.includes(role.name))?.id ?? "";
  const [roleId, setRoleId] = useState(currentRoleId);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isOwnerChosen = options.find((role) => role.id === roleId)?.name === "Owner" && !user.roles.includes("Owner");
  const fullName = `${user.firstName} ${user.lastName}`.trim();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!roleId || roleId === currentRoleId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await changeUserRoleRequest(requireAccessToken(), user.id, roleId);
      onChanged();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, "Couldn't change the role. Please try again."));
      setIsSaving(false);
    }
  };

  return (
    <Modal title={`Change role — ${fullName}`} onClose={isSaving ? undefined : onClose} widthClassName="w-[480px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <span className="text-sm text-bodyGray">
          {user.email} · {user.organisation.name}
        </span>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Role</span>
          <SelectInput value={roleId} onChange={(event) => setRoleId(event.target.value)} autoFocus>
            {!currentRoleId && <option value="">Choose a role</option>}
            {options.map((role) => (
              <option key={role.id} value={role.id}>
                {describeRoleOption(role)}
              </option>
            ))}
          </SelectInput>
        </label>
        {isOwnerChosen && (
          <span className="flex items-start gap-1.5 rounded-lg bg-amberTint px-3 py-2 text-xs text-amber">
            <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 flex-none stroke-amber" />
            Owners see and manage every organisation on FIELD, including users, subscriptions and the shared libraries.
          </span>
        )}
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={isSaving || !roleId || roleId === currentRoleId}>
            <Icon name="check" />
            {isSaving ? "Saving…" : "Save role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
