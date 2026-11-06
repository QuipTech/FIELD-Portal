"use client";

import { useApiResource } from "./useApiResource";
import { fetchCurrentUserRequest } from "../api/authApi";
import type { AccessibleGroup, MachineAccessMode } from "../types/machineGroup";

const NO_GROUPS: AccessibleGroup[] = [];

// The signed-in person's machine access (GET /auth/me), re-read on each
// page load so a changed share shows without signing out. For filters and
// labels only: the API decides what they may see.
export const useMyMachineAccess = (reloadToken = 0) => {
  const me = useApiResource(fetchCurrentUserRequest, [reloadToken], "Couldn't load your machine access.");
  return {
    isLoaded: Boolean(me.data),
    machineAccessMode: (me.data?.machineAccessMode ?? "all") as MachineAccessMode,
    accessibleGroups: me.data?.accessibleGroups ?? NO_GROUPS,
  };
};
