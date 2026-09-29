"use client";

import { useEffect, useState } from "react";
import { fetchCurrentUserRequest } from "../api/authApi";
import { getAccessToken, getStoredUser, saveStoredUser } from "./authSession";
import type { PermissionCode } from "./permissionCodes";

// Every usePermissions() on a page shares one /auth/me request; it's
// cleared once settled, so the next page navigation re-reads permissions
// and an admin's change on the Roles page applies without signing out.
let pendingRefresh: Promise<string[] | null> | null = null;

const refreshPermissions = (): Promise<string[] | null> => {
  const accessToken = getAccessToken();
  if (!accessToken) return Promise.resolve(null);
  pendingRefresh ??= fetchCurrentUserRequest(accessToken)
    .then((currentUser) => {
      const storedUser = getStoredUser();
      if (storedUser) {
        // Also refreshes the avatar: an uploaded one comes back as a newly
        // signed URL, since the previous one expires after 15 minutes.
        saveStoredUser({
          ...storedUser,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          avatarUrl: currentUser.avatarUrl,
          roles: currentUser.roles,
          permissions: currentUser.permissions,
        });
      }
      return currentUser.permissions;
    })
    // Offline or expired session: keep using the stored permissions.
    .catch(() => null)
    .finally(() => {
      pendingRefresh = null;
    });
  return pendingRefresh;
};

// `permissions` is null until read from storage after mount, so server
// and first client render agree; callers treat that as "not yet known".
export const usePermissions = () => {
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    let isMounted = true;
    setPermissions(getStoredUser()?.permissions ?? []);
    refreshPermissions().then((fresh) => {
      if (isMounted && fresh) setPermissions(fresh);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return {
    isLoaded: permissions !== null,
    can: (permission: PermissionCode) => permissions?.includes(permission) ?? false,
  };
};
