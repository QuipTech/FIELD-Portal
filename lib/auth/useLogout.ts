"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutRequest } from "../api/authApi";
import { getRefreshToken } from "./authSession";
import { endLocalSession } from "./endLocalSession";

// Best-effort: the session is revoked server-side when the API call
// succeeds, but the user is always signed out locally and redirected even
// if the backend is unreachable — a broken network shouldn't be able to
// trap someone in a logged-in state.
// isLoggingOut is never reset: logout always ends by leaving the page
// (Cognito's logout redirect or the push to /login).
export const useLogout = () => {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await logoutRequest(refreshToken).catch(() => undefined);
    }
    await endLocalSession(() => router.push("/login"));
  };

  return { logout, isLoggingOut };
};
