import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { getCasePriorityTone } from "@/lib/format/casePriority";
import type { SupportCase } from "@/lib/types/supportCase";

const linkedItems = [
  { icon: "file" as const, label: "2 history entries" },
  { icon: "spark" as const, label: "1 AI thread" },
  { icon: "diff" as const, label: "Config diff 06→18 Mar" },
];

const railLabelClasses = "text-xs font-semibold uppercase tracking-wider text-indigo-300/70";
const pillClasses = "flex h-9 items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm text-slate-800 shadow-sm";

export const CaseDetailsRail = ({ item }: { item: SupportCase }) => {
  return (
    <div className="flex w-[230px] flex-none flex-col gap-0 rounded-2xl bg-[#2D1B69] p-2.5">
      <span className={`pb-2 pt-1 ${railLabelClasses}`}>Details</span>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className={railLabelClasses}>Asset</span>
          <span className="text-[15px] font-semibold text-white">{item.assetId} · CAT 793F</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={railLabelClasses}>Assignee</span>
          <div className={pillClasses}>
            <Avatar initials={item.assignee.initials} size="sm" />
            <span>{item.assignee.name}</span>
            <Icon name="chevd" className="ml-auto h-3.5 w-3.5 stroke-mutedGray" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className={railLabelClasses}>Status</span>
          <div className={pillClasses}>
            <span>Open</span>
            <Icon name="chevd" className="ml-auto h-3.5 w-3.5 stroke-mutedGray" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className={railLabelClasses}>Priority</span>
          <div className={pillClasses}>
            <Tag tone={getCasePriorityTone(item.priority)}>{item.priority}</Tag>
            <Icon name="chevd" className="ml-auto h-3.5 w-3.5 stroke-mutedGray" />
          </div>
        </div>
      </div>
      <span className={`my-4 border-t border-white/10 pb-2 pt-4 ${railLabelClasses}`}>Linked</span>
      <div className="flex flex-col gap-2.5">
        {linkedItems.map((linked) => (
          <span
            key={linked.label}
            className="flex items-center gap-1.5 text-sm text-indigo-200/90 hover:text-white"
          >
            <Icon name={linked.icon} className="h-3.5 w-3.5" />
            {linked.label}
          </span>
        ))}
      </div>
    </div>
  );
};
