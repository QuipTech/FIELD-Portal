"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth/authSession";
import { listAdminUsersRequest } from "@/lib/api/adminUsersApi";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { AdminUser } from "@/lib/types/adminUser";

const SEARCH_DEBOUNCE_MS = 300;
// The table has no pager yet, so fetch the backend's maximum page.
const PAGE_SIZE = 100;
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to see users.";
const FALLBACK_ERROR_MESSAGE = "Couldn't load users. Please try again.";

export const useAdminUsers = (filters: { search: string; role: string; organisationId: string }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const { search, role, organisationId } = filters;

  useEffect(() => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setErrorMessage(SIGNED_OUT_MESSAGE);
      setIsLoading(false);
      return;
    }

    // Ignores a slower, older response that lands after a newer search.
    let isCurrent = true;
    setIsLoading(true);
    const timer = setTimeout(() => {
      listAdminUsersRequest(accessToken, { search, role, organisationId, pageSize: PAGE_SIZE })
        .then((response) => {
          if (!isCurrent) return;
          setUsers(response.users);
          setTotal(response.total);
          setErrorMessage(null);
        })
        .catch((error: unknown) => {
          if (!isCurrent) return;
          setErrorMessage(toApiErrorMessage(error, FALLBACK_ERROR_MESSAGE));
        })
        .finally(() => isCurrent && setIsLoading(false));
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [search, role, organisationId, reloadCount]);

  const reload = () => setReloadCount((count) => count + 1);

  return { users, total, isLoading, errorMessage, reload };
};
