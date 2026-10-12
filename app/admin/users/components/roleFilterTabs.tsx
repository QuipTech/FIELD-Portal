interface RoleFilterTabsProps {
  // "" means every role.
  value: string;
  roleNames: string[];
  onChange: (roleName: string) => void;
}

export const RoleFilterTabs = ({ value, roleNames, onChange }: RoleFilterTabsProps) => {
  const tabs = [{ value: "", label: "All" }, ...roleNames.map((name) => ({ value: name, label: name }))];

  return (
    <div role="tablist" aria-label="Filter by role" className="flex gap-6 overflow-x-auto border-b border-borderGray">
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value || "all"}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`-mb-px flex-none whitespace-nowrap rounded-t border-b-2 pb-2.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-primaryBorder ${
              isActive ? "border-primary font-medium text-primary" : "border-transparent text-bodyGray hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
