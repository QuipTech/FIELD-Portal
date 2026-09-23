"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "../icons/icon";
import { Avatar } from "../ui/avatar";
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

export const UserMenu = ({
  initials = "JO",
  name = "J. Okoye",
  roleLabel = "Technician · Pit 4",
  items = defaultMenuItems,
}: UserMenuProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button aria-label="Account menu" onClick={() => setOpen((value) => !value)}>
        <Avatar initials={initials} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 flex min-w-[212px] flex-col gap-0.5 rounded-xl border border-borderGray bg-white p-1.5 shadow-[0_10px_26px_rgba(30,32,36,0.14)]">
          <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-2">
            <Avatar initials={initials} />
            <div className="flex flex-col gap-px">
              <span className="text-[15px] font-medium text-ink">{name}</span>
              <span className="text-xs text-mutedGray">{roleLabel}</span>
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
