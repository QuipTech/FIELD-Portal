export type GroupDetailTab = "machines" | "assignments" | "activity";

const TABS: { value: GroupDetailTab; label: string }[] = [
  { value: "machines", label: "Machines" },
  { value: "assignments", label: "Assigned to" },
  { value: "activity", label: "Activity" },
];

interface GroupDetailTabsProps {
  value: GroupDetailTab;
  panelId: string;
  onChange: (tab: GroupDetailTab) => void;
}

export const GroupDetailTabs = ({ value, panelId, onChange }: GroupDetailTabsProps) => (
  <div role="tablist" aria-label="Group sections" className="flex flex-none gap-1 border-b border-borderGray pb-1">
    {TABS.map((tab) => {
      const isActive = tab.value === value;
      return (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={isActive}
          aria-controls={panelId}
          onClick={() => onChange(tab.value)}
          className={`rounded-t-lg border-b-2 px-4 py-3 text-sm transition-colors ${
            isActive
              ? "border-primary bg-primaryTint font-medium text-primaryTintText"
              : "border-transparent text-bodyGray hover:bg-surfaceGray hover:text-ink"
          }`}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);
