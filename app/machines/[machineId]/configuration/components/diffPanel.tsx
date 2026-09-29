import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { Table, TableHeaderRow, TableHeaderCell } from "@/components/ui/table";
import { configurationDiffRows } from "@/lib/mockData/configurationHistory";
import type { DiffChangeKind } from "@/lib/types/configurationDiff";

const kindTone: Record<DiffChangeKind, "amber" | "primary" | "danger"> = {
  Changed: "amber",
  Added: "primary",
  Removed: "danger",
};

const kindArrowColor: Record<DiffChangeKind, string> = {
  Changed: "stroke-amber",
  Added: "stroke-primary",
  Removed: "stroke-danger",
};

export const DiffPanel = () => {
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      <div className="flex items-baseline">
        <h2 className="text-base font-medium text-ink">Diff · 06 Mar → 18 Mar</h2>
        <Tag tone="amber" className="ml-auto">4 changes</Tag>
      </div>
      <Table>
        <TableHeaderRow>
          <TableHeaderCell>Before (06 Mar)</TableHeaderCell>
          <TableHeaderCell>After (18 Mar)</TableHeaderCell>
        </TableHeaderRow>
        {configurationDiffRows.map((row) => (
          <div key={row.component} className="flex flex-col gap-1.5 border-b border-borderGray px-3.5 py-3">
            <div className="flex items-center gap-2">
              <Tag tone={kindTone[row.kind]}>{row.kind}</Tag>
              <span className="text-[15px] font-medium text-ink">{row.component}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] text-mutedGray">{row.before}</span>
              <Icon name="arrowr" className={kindArrowColor[row.kind]} />
              <span className="font-mono text-[13px] text-ink">{row.after}</span>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 px-3.5 py-3">
          <Tag>Unchanged</Tag>
          <span className="text-[15px] text-bodyGray">38 other components &amp; settings</span>
          <Icon name="chevd" className="ml-auto stroke-mutedGray" />
        </div>
      </Table>
      <div className="flex gap-2">
        <PermissionButton permission={PERMISSIONS.useAiAssistant} variant="primary">
          <Icon name="spark" />
          Ask AI: what could this cause?
        </PermissionButton>
        <Button>
          <Icon name="download" />
          Export diff
        </Button>
      </div>
    </div>
  );
};
