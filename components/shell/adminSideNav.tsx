"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../icons/icon";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS, type PermissionCode } from "@/lib/auth/permissionCodes";
import { LogoutButton } from "./logoutButton";
import { NavUnreadBadge } from "./navUnreadBadge";
import { useUnreadCaseCount } from "@/lib/hooks/useUnreadCaseCount";
import { useSupportStaffAccess } from "@/lib/hooks/useSupportStaffAccess";

interface AdminNavLink {
  href: string;
  label: string;
  icon: IconName;
  // Hidden from anyone without it.
  permission?: PermissionCode;
  // Shown to QuipTech support staff (not a single permission).
  isStaffOnly?: boolean;
}

const SUPPORT_QUEUE_HREF = "/admin/cases";

// Support staff who aren't the admin reach the admin portal for support
// cases only.
const links: AdminNavLink[] = [
  { href: "/admin/dashboard", label: "Overview", icon: "grid", permission: PERMISSIONS.managePlatform },
  { href: "/admin/users", label: "Users", icon: "users", permission: PERMISSIONS.managePlatform },
  { href: "/admin/roles", label: "Roles & permissions", icon: "shield", permission: PERMISSIONS.managePlatform },
  { href: "/admin/knowledge", label: "Knowledge", icon: "book", permission: PERMISSIONS.managePlatform },
  { href: "/admin/machines", label: "Machine library", icon: "db", permission: PERMISSIONS.managePlatform },
  { href: "/admin/ai-configuration", label: "AI configuration", icon: "sliders", permission: PERMISSIONS.managePlatform },
  { href: "/admin/audit-log", label: "Audit log", icon: "file", permission: PERMISSIONS.managePlatform },
  { href: SUPPORT_QUEUE_HREF, label: "Support cases", icon: "life", isStaffOnly: true },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "card", permission: PERMISSIONS.managePlatform },
  { href: "/admin/demo-requests", label: "Demo requests", icon: "mail", permission: PERMISSIONS.managePlatform },
];

const NavItem = ({ href, label, icon, active, badgeCount = 0 }: AdminNavLink & { active: boolean; badgeCount?: number }) => (
  <Link
    href={href}
    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] transition-colors ${
      active ? "bg-white/[0.16] font-medium text-white" : "text-white/75 hover:bg-white/10"
    }`}
  >
    <Icon name={icon} className={active ? "stroke-white" : "stroke-white/60"} />
    <span className="truncate">{label}</span>
    <NavUnreadBadge count={badgeCount} tone="amber" />
  </Link>
);

export const AdminSideNav = () => {
  const pathname = usePathname();
  const { can } = usePermissions();
  const { isStaff } = useSupportStaffAccess();
  const visibleLinks = links.filter(
    (link) => (!link.permission || can(link.permission)) && (!link.isStaffOnly || isStaff),
  );
  const unreadCaseCount = useUnreadCaseCount("staff", isStaff);

  return (
    <div className="flex w-[216px] flex-none flex-col gap-0.5 rounded-r-[18px] bg-gradient-to-b from-brandDeep to-[#221C52] p-3">
      {visibleLinks.map((link) => (
        <NavItem
          key={link.href}
          {...link}
          active={link.href === SUPPORT_QUEUE_HREF ? pathname.startsWith(link.href) : pathname === link.href}
          badgeCount={link.href === SUPPORT_QUEUE_HREF ? unreadCaseCount : 0}
        />
      ))}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-white/[0.16] pt-2.5">
        {can(PERMISSIONS.managePlatform) && (
          <NavItem href="/admin/settings" label="Settings" icon="settings" active={pathname === "/admin/settings"} />
        )}
        <LogoutButton
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[15px] text-white/75"
          iconClassName="stroke-white/60"
        />
      </div>
    </div>
  );
};
