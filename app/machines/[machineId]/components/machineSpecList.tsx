import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import type { Machine } from "@/lib/types/machine";

interface MachineSpecListProps {
  machine: Machine;
}

export const MachineSpecList = ({ machine }: MachineSpecListProps) => {
  return (
    <div className="flex flex-1 flex-col rounded-xl border border-borderGray bg-white px-3.5">
      <div className="flex items-center gap-3 border-b border-borderGray py-2.5">
        <span className="w-24 text-xs font-medium uppercase tracking-wide text-mutedGray">Serial</span>
        <span className="font-mono text-[15px] text-ink">4GZ01288</span>
        <span className="ml-auto rounded-md border border-borderGrayStrong bg-fillGray px-2 py-0.5 text-xs text-bodyGray">
          Copy
        </span>
      </div>
      <div className="flex items-center gap-3 border-b border-borderGray py-2.5">
        <span className="w-24 text-xs font-medium uppercase tracking-wide text-mutedGray">Hours</span>
        <span className="text-[15px] text-ink">{machine.hours.toLocaleString()} h</span>
        <span className="ml-auto text-xs text-mutedGray">Read 19 Mar 06:00</span>
      </div>
      <div className="flex items-center gap-3 border-b border-borderGray py-2.5">
        <span className="w-24 text-xs font-medium uppercase tracking-wide text-mutedGray">Site</span>
        <span className="text-[15px] text-ink">{machine.site} · Bench 3</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-mutedGray">
          <Icon name="pin" className="h-3.5 w-3.5" /> Last seen 40 min ago
        </span>
      </div>
      <div className="flex items-center gap-3 py-2.5">
        <span className="w-24 text-xs font-medium uppercase tracking-wide text-mutedGray">Owner</span>
        <span className="text-[15px] text-ink">J. Okoye</span>
        <Avatar initials="JO" size="sm" className="ml-auto" />
      </div>
    </div>
  );
};
