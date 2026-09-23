import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";

const filterGroups: { label: string; value: string; tone: "primary" | "default" }[] = [
  { label: "Site", value: "Pit 4", tone: "primary" },
  { label: "Make", value: "All makes", tone: "default" },
  { label: "Status", value: "Any status", tone: "default" },
  { label: "Class", value: "Any class", tone: "default" },
];

export const MachinesFilterCard = () => {
  return (
    <div className="flex w-[200px] flex-none flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-borderGray bg-white p-3.5">
        <div className="flex items-center">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Filters</span>
          <Icon name="filter" className="ml-auto h-3.5 w-3.5 stroke-mutedGray" />
        </div>
        {filterGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-mutedGray">{group.label}</span>
            <Tag tone={group.tone} className="w-fit">
              {group.value}
              <Icon name={group.tone === "primary" ? "x" : "chevd"} className="h-3.5 w-3.5" />
            </Tag>
          </div>
        ))}
        <button className="w-full rounded-lg py-1.5 text-center text-[13px] text-mutedGray hover:bg-fillGray">
          Clear filters
        </button>
      </div>
      <span className="text-center text-xs text-mutedGray">248 results</span>
    </div>
  );
};
