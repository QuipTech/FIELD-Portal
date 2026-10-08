import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { diffKindMeta, formatDiffValue } from "@/lib/machineDetail/snapshotDiffText";
import type { DiffRow } from "@/lib/types/configurationDiff";

export const DiffRowItem = ({ row }: { row: DiffRow }) => {
  const meta = diffKindMeta[row.kind];
  return (
    <div className="flex flex-col gap-1.5 border-b border-borderGray px-3.5 py-3">
      <div className="flex items-center gap-2">
        <Tag tone={meta.tone}>{meta.label}</Tag>
        <span className="text-[15px] font-medium text-ink">{row.componentName}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[13px] text-mutedGray">{formatDiffValue(row.before)}</span>
        <Icon name="arrowr" className={meta.arrowClass} />
        <span className="font-mono text-[13px] text-ink">{formatDiffValue(row.after)}</span>
      </div>
    </div>
  );
};
