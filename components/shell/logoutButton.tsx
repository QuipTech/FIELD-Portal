"use client";

import { Icon } from "../icons/icon";
import { LoadingSpinner } from "../ui/loadingSpinner";
import { useLogout } from "@/lib/auth/useLogout";

interface LogoutButtonProps {
  className: string;
  iconClassName?: string;
  label?: string;
}

export const LogoutButton = ({ className, iconClassName, label = "Log out" }: LogoutButtonProps) => {
  const { logout, isLoggingOut } = useLogout();

  return (
    <>
      <button type="button" onClick={logout} disabled={isLoggingOut} className={`${className} disabled:opacity-70`}>
        {isLoggingOut ? <LoadingSpinner /> : <Icon name="logout" className={iconClassName} />}
        {/* A collapsed side nav passes an empty label: spinner only. */}
        {isLoggingOut && label ? "Logging out…" : label}
      </button>
      {/* Logout can take a few seconds (backend call, then Cognito's logout
          redirect for Google/Apple users) — block the page meanwhile. */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inkStatic/40">
          <div className="flex items-center gap-3 rounded-2xl bg-surface px-6 py-4 text-primary shadow-lg">
            <LoadingSpinner size="md" />
            <span className="text-[15px] font-medium text-ink">Signing you out…</span>
          </div>
        </div>
      )}
    </>
  );
};
