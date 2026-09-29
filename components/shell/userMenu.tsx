"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "../icons/icon";
import { Avatar } from "../ui/avatar";
import { useSignedInProfile } from "@/lib/auth/useSignedInProfile";
import { getInitials } from "@/lib/format/nameInitials";
import { LogoutButton } from "./logoutButton";

export interface UserMenuItem {
  icon: IconName;
  label: string;
  href: string;
}

const defaultMenuItems: UserMenuItem[] = [
  { icon: "pin", label: "Change site · Pit 4", href: "/dashboard" },
  { icon: "cloud", label: "Offline downloads", href: "/dashboard" },
  { icon: "settings", label: "Settings", href: "/settings" },
];

interface UserMenuProps {
  initials?: string;
  name?: string;
  roleLabel?: string;
  items?: UserMenuItem[];
}

// Explicit props win (e.g. the admin top bar); otherwise the signed-in
// user is shown, falling back to the demo persona when nobody is.
export const UserMenu = ({ initials, name, roleLabel, items = defaultMenuItems }: UserMenuProps) => {
  const [open, setOpen] = useState(false);
  const signedInProfile = useSignedInProfile();
  const signedInName = signedInProfile
    ? `${signedInProfile.user.firstName} ${signedInProfile.user.lastName}`.trim()
    : undefined;

  const displayName = name ?? signedInName ?? "J. Okoye";
  const displayInitials = initials ?? (signedInName ? getInitials(signedInName) : "JO");
  const displayRoleLabel = roleLabel ?? signedInProfile?.tenant?.name ?? "Technician · Pit 4";
  // A photo only belongs to the signed-in user, not to an explicit persona.
  const avatarUrl = initials ? undefined : (signedInProfile?.user.avatarUrl ?? undefined);

  return (
    <div className="relative">
      <button aria-label="Account menu" onClick={() => setOpen((value) => !value)}>
        <Avatar initials={displayInitials} imageSrc={avatarUrl} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 flex min-w-[212px] flex-col gap-0.5 rounded-xl border border-borderGray bg-surface p-1.5 shadow-[0_10px_26px_rgba(30,32,36,0.14)]">
          <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-2">
            <Avatar initials={displayInitials} imageSrc={avatarUrl} />
            <div className="flex flex-col gap-px">
              <span className="text-[15px] font-medium text-ink">{displayName}</span>
              <span className="text-xs text-mutedGray">{displayRoleLabel}</span>
            </div>
          </div>
          <div className="mx-0.5 mb-1 h-px bg-borderGray" />
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[15px] text-bodyGray hover:bg-fillGray"
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
          <div className="mx-0.5 my-1 h-px bg-borderGray" />
          <LogoutButton className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[15px] text-bodyGray hover:bg-fillGray" />
        </div>
      ) : null}
    </div>
  );
};
