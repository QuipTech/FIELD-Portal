"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/settings", label: "Branding" },
  { href: "/admin/settings/notifications", label: "Notifications & alerts" },
  { href: "/admin/settings/reports", label: "Reports & exports" },
  { href: "/admin/settings/data-retention", label: "Data & retention" },
];

export const SettingsTabsNav = () => {
  const pathname = usePathname();

  return (
    <div className="flex items-end gap-5">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 pb-2.5 text-[15px] ${
              active ? "border-[#4F39F6] font-medium text-[#4F39F6]" : "border-transparent text-bodyGray"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
};
