"use client";

import { useState } from "react";
import { deleteAccountRequest } from "../api/accountApi";
import { clearAuthSession, getAccessToken } from "./authSession";

const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to delete your account.";
const FALLBACK_ERROR_MESSAGE = "We couldn't delete your account. Please try again.";

// Unlike logout this is not best-effort: the local session is only cleared
// once the backend confirms the deletion, so a failure leaves the user
// signed in and able to retry.
export const useDeleteAccount = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deleteAccount = async (): Promise<boolean> => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setErrorMessage(SIGNED_OUT_MESSAGE);
      return false;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await deleteAccountRequest(accessToken);
      clearAuthSession();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE);
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteAccount, isDeleting, errorMessage };
};
