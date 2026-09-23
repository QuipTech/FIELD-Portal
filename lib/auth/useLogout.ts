"use client";

import { useRouter } from "next/navigation";
import { logoutRequest } from "../api/authApi";
import { clearAuthSession, getRefreshToken } from "./authSession";

// Best-effort: the session is revoked server-side when the API call
// succeeds, but the user is always signed out locally and redirected even
// if the backend is unreachable — a broken network shouldn't be able to
// trap someone in a logged-in state.
export const useLogout = () => {
  const router = useRouter();

  return async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await logoutRequest(refreshToken).catch(() => undefined);
    }
    clearAuthSession();
    router.push("/login");
  };
};
