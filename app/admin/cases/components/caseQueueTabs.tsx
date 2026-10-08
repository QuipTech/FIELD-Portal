import type { AdminCaseStats, AdminCaseTab } from "@/lib/types/adminSupportCase";

interface QueueTab {
  value: AdminCaseTab;
  label: string;
  count?: (stats: AdminCaseStats) => number;
  isAdminOnly?: boolean;
}

const TABS: QueueTab[] = [
  { value: "unassigned", label: "Unassigned", count: (stats) => stats.unassigned, isAdminOnly: true },
  { value: "mine", label: "Assigned to me", count: (stats) => stats.assignedToMe },
  { value: "open", label: "All open", count: (stats) => stats.allOpen },
  { value: "resolved", label: "Resolved" },
];

interface CaseQueueTabsProps {
  value: AdminCaseTab;
  stats: AdminCaseStats | null;
  isAdmin: boolean;
  onChange: (tab: AdminCaseTab) => void;
}

// "Unassigned · 3", "Assigned to me · 5", "All open · 15", "Resolved".
export const CaseQueueTabs = ({ value, stats, isAdmin, onChange }: CaseQueueTabsProps) => (
  <div role="tablist" aria-label="Support cases" className="flex flex-1 gap-6 border-b border-borderGray">
    {TABS.filter((tab) => isAdmin || !tab.isAdminOnly).map((tab) => {
      const isActive = tab.value === value;
      const count = stats && tab.count ? ` · ${tab.count(stats)}` : "";
      return (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(tab.value)}
          className={`-mb-px rounded-t border-b-2 pb-2.5 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-primaryBorder ${
            isActive ? "border-primary font-medium text-primary" : "border-transparent text-bodyGray hover:text-ink"
          }`}
        >
          {tab.label}
          {count}
        </button>
      );
    })}
  </div>
);
