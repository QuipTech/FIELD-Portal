"use client";

import { Icon } from "../icons/icon";
import { useLogout } from "@/lib/auth/useLogout";

interface LogoutButtonProps {
  className: string;
  iconClassName?: string;
  label?: string;
}

export const LogoutButton = ({ className, iconClassName, label = "Log out" }: LogoutButtonProps) => {
  const logout = useLogout();

  return (
    <button type="button" onClick={logout} className={className}>
      <Icon name="logout" className={iconClassName} />
      {label}
    </button>
  );
};
