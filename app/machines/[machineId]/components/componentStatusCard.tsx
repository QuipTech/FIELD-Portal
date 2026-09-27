import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import type { MachineComponentStatus } from "@/lib/types/machineComponent";

export const ComponentStatusCard = ({ name, note, tag, tone, icon }: MachineComponentStatus) => {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-borderGray bg-surface p-3.5">
      <div className="flex items-center">
        <span className="text-[15px] font-medium text-ink">{name}</span>
        <Tag tone={tone} className="ml-auto">
          <Icon name={icon} className="h-3.5 w-3.5" />
          {tag}
        </Tag>
      </div>
      <span className="text-xs text-mutedGray">{note}</span>
    </div>
  );
};
