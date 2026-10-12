"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { RolesList } from "./rolesList";
import { PermissionsPanel } from "./permissionsPanel";
import { NewRoleModal } from "./newRoleModal";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { AdminRole } from "@/lib/types/adminRole";
import { useAdminRoles } from "../useAdminRoles";

export const RolesManager = () => {
  const {
    roles,
    permissions,
    selectedRole,
    selectRole,
    isLoading,
    loadError,
    saveRolePermissions,
    createRole,
    deleteRole,
  } = useAdminRoles();
  const [isNewRoleOpen, setIsNewRoleOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<AdminRole | null>(null);

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-[22px] font-medium text-ink">Roles &amp; permissions</h1>
        <Button
          variant="primary"
          className="ml-auto"
          onClick={() => setIsNewRoleOpen(true)}
          disabled={isLoading || Boolean(loadError)}
        >
          <Icon name="plus" />
          New role
        </Button>
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 p-10 text-sm text-mutedGray">
          <LoadingSpinner /> Loading roles…
        </div>
      )}
      {loadError && <span className="p-10 text-sm text-danger">{loadError}</span>}
      {!isLoading && !loadError && (
        <div className="flex min-h-0 flex-1 gap-4">
          <RolesList
            roles={roles}
            selectedRoleId={selectedRole?.id ?? null}
            totalPermissions={permissions.length}
            onSelect={selectRole}
          />
          {selectedRole && (
            <PermissionsPanel
              role={selectedRole}
              permissions={permissions}
              onSave={saveRolePermissions}
              onDelete={setRoleToDelete}
            />
          )}
        </div>
      )}
      {isNewRoleOpen && <NewRoleModal onCreate={createRole} onClose={() => setIsNewRoleOpen(false)} />}
      {roleToDelete && (
        <ConfirmDialog
          title={`Delete ${roleToDelete.name}?`}
          confirmLabel="Delete role"
          onConfirm={async () => {
            await deleteRole(roleToDelete.id);
            setRoleToDelete(null);
          }}
          onClose={() => setRoleToDelete(null)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the role. Please try again.")}
          isConfirmDisabled={roleToDelete.userCount > 0}
        >
          {roleToDelete.userCount > 0
            ? `${roleToDelete.userCount} ${roleToDelete.userCount === 1 ? "user still has" : "users still have"} this role. Give them another role on the Users page first.`
            : "The role and its permissions are removed. This can't be undone."}
        </ConfirmDialog>
      )}
    </>
  );
};
