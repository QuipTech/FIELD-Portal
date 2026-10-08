import Link from "next/link";

export type MachineTab = "components" | "history" | "config-history" | "manuals" | "cases";

interface MachineTabsProps {
  machineId: string;
  active: MachineTab;
  // Null while it loads or when it couldn't be counted.
  openCaseCount: number | null;
}

// Manuals and cases open the knowledge library and cases screens.
export const MachineTabs = ({ machineId, active, openCaseCount }: MachineTabsProps) => {
  const tabs: { key: MachineTab; label: string; href: string }[] = [
    { key: "components", label: "Components", href: `/machines/${machineId}` },
    { key: "history", label: "History", href: `/machines/${machineId}/history` },
    { key: "config-history", label: "Configuration history", href: `/machines/${machineId}/config-history` },
    { key: "manuals", label: "Manuals", href: "/knowledge" },
    { key: "cases", label: "Open cases", href: "/cases" },
  ];

  return (
    <nav aria-label="Machine sections" className="flex items-end gap-5 overflow-x-auto border-b border-borderGray">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={`flex flex-none items-center gap-1.5 border-b-2 pb-2.5 text-[15px] ${
            active === tab.key ? "border-primary font-medium text-primaryHover" : "border-transparent text-bodyGray hover:text-ink"
          }`}
        >
          {tab.label}
          {tab.key === "cases" && openCaseCount !== null && (
            <span className="rounded-full bg-dangerTint px-1.5 text-xs font-medium text-danger">{openCaseCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
};
