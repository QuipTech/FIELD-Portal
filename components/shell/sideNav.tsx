"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "../icons/icon";
import { LogoutButton } from "./logoutButton";

interface NavLink {
  href: string;
  label: string;
  icon: IconName;
}

const primaryLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/machines", label: "Machines", icon: "truck" },
  { href: "/knowledge", label: "Knowledge", icon: "book" },
  { href: "/assistant", label: "AI assistant", icon: "spark" },
  { href: "/cases", label: "Support cases", icon: "life" },
];

const NavItem = ({ href, label, icon, active }: NavLink & { active: boolean }) => (
  <Link
    href={href}
    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] transition-colors ${
      active ? "bg-white/[0.16] font-medium text-white" : "text-white/75 hover:bg-white/10"
    }`}
  >
    <Icon name={icon} className={active ? "stroke-white" : "stroke-white/60"} />
    <span className="truncate">{label}</span>
  </Link>
);

export const SideNav = () => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`flex flex-none flex-col gap-0.5 rounded-r-[18px] bg-gradient-to-b from-primaryHover to-[#221C52] p-3 pt-3 transition-[width] duration-150 ${
        collapsed ? "w-16" : "w-[216px]"
      }`}
    >
      <button
        onClick={() => setCollapsed((value) => !value)}
        className="mb-1.5 ml-0.5 flex h-[30px] w-[30px] items-center justify-center rounded-lg text-white/55 hover:bg-white/10"
      >
        <Icon name="panel" className="stroke-current" />
      </button>
      {primaryLinks.map((link) => (
        <NavItem
          key={link.href}
          {...link}
          label={collapsed ? "" : link.label}
          active={pathname.startsWith(link.href)}
        />
      ))}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-white/[0.16] pt-2.5">
        <NavItem
          href="/settings"
          label={collapsed ? "" : "Settings"}
          icon="settings"
          active={pathname.startsWith("/settings")}
        />
        <LogoutButton
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] text-white/75 transition-colors hover:bg-white/10"
          iconClassName="stroke-white/60"
          label={collapsed ? "" : "Log out"}
        />
      </div>
    </div>
  );
};
