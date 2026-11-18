"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/machine-control";

const TABS: { href: string; label: string; isSoon?: boolean }[] = [
  { href: BASE, label: "Overview" },
  { href: `${BASE}/devices`, label: "Devices" },
  { href: `${BASE}/sites`, label: "Sites", isSoon: true },
  { href: `${BASE}/files`, label: "Files" },
  { href: `${BASE}/activity`, label: "Activity", isSoon: true },
];

export const MachineControlTabs = () => {
  const pathname = usePathname();
  return (
    <nav aria-label="Machine Control sections" className="flex flex-none items-end gap-5 overflow-x-auto border-b border-borderGray">
      {TABS.map((tab) => {
        const isActive = tab.href === BASE ? pathname === BASE : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-none items-center gap-1.5 border-b-2 pb-2.5 text-[15px] ${
              isActive ? "border-primary font-medium text-primaryHover" : "border-transparent text-bodyGray hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.isSoon && <span className="rounded-full bg-fillGray px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-mutedGray">Soon</span>}
          </Link>
        );
      })}
    </nav>
  );
};
