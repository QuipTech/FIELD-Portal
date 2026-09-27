"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { RolesList } from "./rolesList";
import { PermissionsPanel } from "./permissionsPanel";
import { NewRoleModal } from "./newRoleModal";
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
  } = useAdminRoles();
  const [isNewRoleOpen, setIsNewRoleOpen] = useState(false);

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
            <PermissionsPanel role={selectedRole} permissions={permissions} onSave={saveRolePermissions} />
          )}
        </div>
      )}
      {isNewRoleOpen && <NewRoleModal onCreate={createRole} onClose={() => setIsNewRoleOpen(false)} />}
    </>
  );
};
