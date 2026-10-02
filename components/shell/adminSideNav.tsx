"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../icons/icon";
import { LogoutButton } from "./logoutButton";

interface AdminNavLink {
  href: string;
  label: string;
  icon: IconName;
}

const links: AdminNavLink[] = [
  { href: "/admin/dashboard", label: "Overview", icon: "grid" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/roles", label: "Roles & permissions", icon: "shield" },
  { href: "/admin/knowledge", label: "Knowledge", icon: "book" },
  { href: "/admin/machines", label: "Machine library", icon: "db" },
  { href: "/admin/ai-configuration", label: "AI configuration", icon: "sliders" },
  { href: "/admin/audit-log", label: "Audit log", icon: "file" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "card" },
];

const NavItem = ({ href, label, icon, active }: AdminNavLink & { active: boolean }) => (
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

export const AdminSideNav = () => {
  const pathname = usePathname();

  return (
    <div className="flex w-[216px] flex-none flex-col gap-0.5 rounded-r-[18px] bg-gradient-to-b from-brandDeep to-[#221C52] p-3">
      {links.map((link) => (
        <NavItem key={link.href} {...link} active={pathname === link.href} />
      ))}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-white/[0.16] pt-2.5">
        <NavItem
          href="/admin/settings"
          label="Settings"
          icon="settings"
          active={pathname === "/admin/settings"}
        />
        <LogoutButton
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] text-white/75"
          iconClassName="stroke-white/60"
        />
      </div>
    </div>
  );
};
