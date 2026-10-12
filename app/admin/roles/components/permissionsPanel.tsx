"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons/icon";
import { Switch } from "@/components/ui/switch";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { AdminPermission, AdminRole } from "@/lib/types/adminRole";
import { PermissionsSavedDialog } from "./permissionsSavedDialog";

interface PermissionsPanelProps {
  role: AdminRole;
  permissions: AdminPermission[];
  onSave: (roleId: string, permissionCodes: string[]) => Promise<void>;
  // Shown only for roles that were added (default roles can't be deleted).
  onDelete: (role: AdminRole) => void;
}

const SAVE_FAILED_MESSAGE = "Couldn't save the permissions. Please try again.";

const hasSameCodes = (draft: Set<string>, saved: string[]) =>
  draft.size === saved.length && saved.every((code) => draft.has(code));

export const PermissionsPanel = ({ role, permissions, onSave, onDelete }: PermissionsPanelProps) => {
  const [draftCodes, setDraftCodes] = useState(() => new Set(role.permissionCodes));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavedDialogOpen, setIsSavedDialogOpen] = useState(false);

  // Switching roles (or a save landing) resets the draft to what's stored.
  useEffect(() => {
    setDraftCodes(new Set(role.permissionCodes));
    setSaveError(null);
  }, [role]);

  const isDirty = !hasSameCodes(draftCodes, role.permissionCodes);
  // System roles are read-only for an Owner; the API refuses them too.
  const isReadOnly = role.arePermissionsLocked || !role.isEditable;

  const togglePermission = (code: string) => {
    setDraftCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(role.id, Array.from(draftCodes));
      setIsSavedDialogOpen(true);
    } catch (error) {
      setSaveError(toApiErrorMessage(error, SAVE_FAILED_MESSAGE));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-[1.7] flex-col rounded-xl border border-borderGray bg-surface p-4">
      <div className="flex items-center gap-3 pb-2.5">
        <h2 className="text-base font-medium text-ink">Permissions — {role.name}</h2>
        {role.isEditable && !role.isBuiltIn && (
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => onDelete(role)}>
            <Icon name="x" className="h-3.5 w-3.5" />
            Delete role
          </Button>
        )}
        <span className="ml-auto text-xs text-mutedGray">
          {role.arePermissionsLocked
            ? "Always has every permission"
            : role.isEditable
              ? "Changes are audited"
              : "System role — managed by QuipTech"}
        </span>
      </div>
      <div className="flex flex-col divide-y divide-slate-100 overflow-y-auto">
        {permissions.map((permission) => (
          <div key={permission.code} className="flex items-center py-2.5">
            <span className="text-[15px] text-ink">{permission.label}</span>
            <span className="ml-auto">
              <Switch
                on={draftCodes.has(permission.code)}
                onToggle={() => togglePermission(permission.code)}
                disabled={isReadOnly || isSaving}
              />
            </span>
          </div>
        ))}
      </div>
      <div className={`mt-auto items-center gap-3 border-t border-slate-100 pt-3.5 ${isReadOnly ? "hidden" : "flex"}`}>
        <Button
          variant="ghost"
          onClick={() => setDraftCodes(new Set(role.permissionCodes))}
          disabled={!isDirty || isSaving}
        >
          Discard
        </Button>
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <Button variant="primary" className="ml-auto" onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </div>
      {isSavedDialogOpen && (
        <PermissionsSavedDialog
          roleName={role.name}
          grantedCount={role.permissionCodes.length}
          totalCount={permissions.length}
          onClose={() => setIsSavedDialogOpen(false)}
        />
      )}
    </div>
  );
};
