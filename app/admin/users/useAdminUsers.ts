"use client";

import { useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth/authSession";
import { listAdminUsersRequest } from "@/lib/api/adminUsersApi";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { AdminUser } from "@/lib/types/adminUser";

export const USERS_PAGE_SIZE = 25;
const FETCH_PAGE_SIZE = 100;
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to see users.";
const FALLBACK_ERROR_MESSAGE = "Couldn't load users. Please try again.";

// Load the complete authorised directory; tabs, search and pagination stay local.
export const useAdminUsers = (search: string, role: string, page: number) => {
  const [result, setResult] = useState<{ token: string; users: AdminUser[]; error?: string } | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const accessToken = getAccessToken();

  useEffect(() => {
    setResult(null);
    if (!accessToken) return;
    let isCurrent = true;
    const load = async () => {
      try {
        const users: AdminUser[] = [];
        let nextPage = 1;
        // Fetch every API page so local filters never omit users on later pages.
        while (isCurrent) {
          const response = await listAdminUsersRequest(accessToken, { page: nextPage, pageSize: FETCH_PAGE_SIZE });
          if (!isCurrent) return;
          users.push(...response.users);
          if (users.length >= response.total || response.users.length === 0) break;
          nextPage += 1;
        }
        if (isCurrent) setResult({ token: accessToken, users });
      } catch (error: unknown) {
        if (isCurrent) setResult({ token: accessToken, users: [], error: toApiErrorMessage(error, FALLBACK_ERROR_MESSAGE) });
      }
    };
    void load();
    return () => { isCurrent = false; };
  }, [accessToken, reloadCount]);

  const currentResult = result?.token === accessToken ? result : null;
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (currentResult?.users ?? []).filter((user) => {
      if (role && !user.roles.includes(role)) return false;
      const name = `${user.firstName} ${user.lastName}`.toLowerCase();
      return !query || name.includes(query) || user.email.toLowerCase().includes(query);
    });
  }, [currentResult, search, role]);

  const reload = () => {
    setResult(null);
    setReloadCount((count) => count + 1);
  };
  const errorMessage = !accessToken ? SIGNED_OUT_MESSAGE : currentResult?.error ?? null;
  const start = (page - 1) * USERS_PAGE_SIZE;
  return {
    users: filteredUsers.slice(start, start + USERS_PAGE_SIZE),
    total: filteredUsers.length,
    isLoading: !currentResult && !errorMessage,
    errorMessage,
    reload,
  };
};
