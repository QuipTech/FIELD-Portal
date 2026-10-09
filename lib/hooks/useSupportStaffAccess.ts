"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "../auth/authSession";
import { getSupportStaffAccessRequest } from "../api/adminSupportCasesApi";

export interface SupportStaffAccess {
  isLoaded: boolean;
  // QuipTech support staff: role holders, or anyone on QuipTech's own team.
  isStaff: boolean;
  isAdmin: boolean;
}

const NOT_STAFF: SupportStaffAccess = { isLoaded: true, isStaff: false, isAdmin: false };

// One request per page load, shared by every caller on the page.
let pending: Promise<SupportStaffAccess> | null = null;

const loadAccess = (): Promise<SupportStaffAccess> => {
  const accessToken = getAccessToken();
  if (!accessToken) return Promise.resolve(NOT_STAFF);
  pending ??= getSupportStaffAccessRequest(accessToken)
    .then(({ isAdmin }) => ({ isLoaded: true, isStaff: true, isAdmin }))
    // 403: not staff. Offline or expired: show nothing staff-only.
    .catch(() => NOT_STAFF)
    .finally(() => setTimeout(() => (pending = null), 0));
  return pending;
};

// Who may use the staff Support cases screens. Staff isn't a single
// permission (QuipTech's whole team counts), so the API decides.
export const useSupportStaffAccess = (): SupportStaffAccess => {
  const [access, setAccess] = useState<SupportStaffAccess>({ isLoaded: false, isStaff: false, isAdmin: false });

  useEffect(() => {
    let isMounted = true;
    loadAccess().then((loaded) => isMounted && setAccess(loaded));
    return () => {
      isMounted = false;
    };
  }, []);

  return access;
};
