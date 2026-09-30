import Link from "next/link";

type MachineTab = "components" | "history" | "configuration" | "manuals" | "cases";

interface MachineTabsProps {
  machineId: string;
  active: MachineTab;
}

export const MachineTabs = ({ machineId, active }: MachineTabsProps) => {
  const tabs: { key: MachineTab; label: string; href: string }[] = [
    { key: "components", label: "Components", href: `/machines/${machineId}` },
    { key: "history", label: "History", href: `/machines/${machineId}/history` },
    { key: "configuration", label: "Configuration history", href: `/machines/${machineId}/configuration` },
    { key: "manuals", label: "Manuals", href: "/knowledge" },
    { key: "cases", label: "Open cases", href: "/cases" },
  ];

  return (
    <div className="flex items-end gap-5 border-b border-borderGray">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`flex items-center gap-1.5 border-b-2 pb-2.5 text-[15px] ${
            active === tab.key
              ? "border-primary font-medium text-primaryHover"
              : "border-transparent text-bodyGray"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
};
