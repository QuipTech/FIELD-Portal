"use client";

import { useEffect, useState } from "react";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import {
  createAdminRoleRequest,
  listAdminPermissionsRequest,
  listAdminRolesRequest,
  updateAdminRoleRequest,
} from "@/lib/api/adminRolesApi";
import type { AdminPermission, AdminRole } from "@/lib/types/adminRole";

const LOAD_FAILED_MESSAGE = "Couldn't load roles. Please try again.";

const replaceRole = (roles: AdminRole[], updated: AdminRole) =>
  roles.map((role) => (role.id === updated.id ? updated : role));

export const useAdminRoles = () => {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const loadRolesAndPermissions = async () => {
      const accessToken = requireAccessToken();
      const [loadedRoles, loadedPermissions] = await Promise.all([
        listAdminRolesRequest(accessToken),
        listAdminPermissionsRequest(accessToken),
      ]);
      if (!isCurrent) return;
      setRoles(loadedRoles);
      setPermissions(loadedPermissions);
      setSelectedRoleId(loadedRoles[0]?.id ?? null);
    };
    loadRolesAndPermissions()
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setLoadError(toApiErrorMessage(error, LOAD_FAILED_MESSAGE));
      })
      .finally(() => isCurrent && setIsLoading(false));
    return () => {
      isCurrent = false;
    };
  }, []);

  // Rejects with the API's error so the calling form can show it.
  const saveRolePermissions = async (roleId: string, permissionCodes: string[]) => {
    const updated = await updateAdminRoleRequest(requireAccessToken(), roleId, { permissionCodes });
    setRoles((current) => replaceRole(current, updated));
  };

  const createRole = async (name: string) => {
    const created = await createAdminRoleRequest(requireAccessToken(), { name });
    setRoles((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedRoleId(created.id);
  };

  return {
    roles,
    permissions,
    selectedRole: roles.find((role) => role.id === selectedRoleId) ?? null,
    selectRole: setSelectedRoleId,
    isLoading,
    loadError,
    saveRolePermissions,
    createRole,
  };
};
