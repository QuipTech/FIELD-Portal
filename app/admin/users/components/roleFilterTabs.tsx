interface RoleFilterTabsProps {
  // "" means every role.
  value: string;
  roleNames: string[];
  panelId: string;
  onChange: (roleName: string) => void;
}

export const RoleFilterTabs = ({ value, roleNames, panelId, onChange }: RoleFilterTabsProps) => {
  const tabs = [{ value: "", label: "All" }, ...roleNames.map((name) => ({ value: name, label: name }))];

  return (
    <div role="tablist" aria-label="Filter by role" className="flex w-full min-w-0 flex-none gap-1 overflow-x-auto border-b border-borderGray pb-1">
      {tabs.map((tab, index) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value || "all"}
            type="button"
            role="tab"
            id={`${panelId}-tab-${index}`}
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={(event) => {
              let nextIndex: number;
              switch (event.key) {
                case "ArrowRight": nextIndex = (index + 1) % tabs.length; break;
                case "ArrowLeft": nextIndex = (index - 1 + tabs.length) % tabs.length; break;
                case "Home": nextIndex = 0; break;
                case "End": nextIndex = tabs.length - 1; break;
                default: return;
              }
              event.preventDefault();
              onChange(tabs[nextIndex].value);
              const nextTab = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex];
              nextTab?.focus({ preventScroll: true });
              nextTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
            }}
            onClick={() => onChange(tab.value)}
            className={`flex-none whitespace-nowrap rounded-t-lg border-b-2 px-4 py-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
              isActive ? "border-primary bg-primaryTint font-medium text-primaryTintText" : "border-transparent text-bodyGray hover:bg-surfaceGray hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
