import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { IconButton } from "../ui/iconButton";
import { UserMenu, type UserMenuItem } from "./userMenu";

interface TopBarProps {
  children?: ReactNode;
  actions?: ReactNode;
  logoHref?: string;
  userInitials?: string;
  userName?: string;
  userRoleLabel?: string;
  userMenuItems?: UserMenuItem[];
  showThemeToggle?: boolean;
  showUserMenu?: boolean;
}

export const TopBar = ({
  children,
  actions,
  logoHref = "/dashboard",
  userInitials,
  userName,
  userRoleLabel,
  userMenuItems,
  showThemeToggle = true,
  showUserMenu = true,
}: TopBarProps) => {
  return (
    <div className="flex h-14 flex-none items-center gap-3.5 border-b border-borderGray bg-white px-4">
      <Link href={logoHref} className="flex flex-none items-center gap-2">
        <Image src="/quiptechFieldLogo.png" alt="QuipTech FIELD" width={140} height={47} className="h-5 w-auto" />
      </Link>
      {children}
      <div className="ml-auto flex items-center gap-3">
        {actions}
        {showThemeToggle && <IconButton icon="moon" />}
        {showUserMenu && (
          <UserMenu initials={userInitials} name={userName} roleLabel={userRoleLabel} items={userMenuItems} />
        )}
      </div>
    </div>
  );
};
