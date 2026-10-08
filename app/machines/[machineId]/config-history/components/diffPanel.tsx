"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { ActionMenu } from "@/components/ui/actionMenu";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { EmptyState } from "@/components/ui/emptyState";
import { buttonBaseClasses, buttonSizeClasses, buttonVariantClasses } from "@/components/ui/buttonStyles";
import { PermissionButton } from "@/components/auth/permissionButton";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { saveBlobAsFile } from "@/lib/format/saveBlobAsFile";
import { buildAssistantHref } from "@/lib/machineDetail/assistantHref";
import { buildDiffQuestion, diffExportFileName, formatSnapshotDay } from "@/lib/machineDetail/snapshotDiffText";
import { Table, TableHeaderRow, TableHeaderCell } from "@/components/ui/table";
import type { DiffExportFormat, SnapshotDiff } from "@/lib/types/configurationDiff";
import { useMachineDetail } from "../../machineDetailContext";
import { DiffRowItem } from "./diffRowItem";
import { UnchangedRows } from "./unchangedRows";

interface DiffPanelProps {
  diff: SnapshotDiff | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

const exportButtonClasses = `${buttonBaseClasses} ${buttonVariantClasses.default} ${buttonSizeClasses.md}`;

export const DiffPanel = ({ diff, isLoading, error, onRetry }: DiffPanelProps) => {
  const router = useRouter();
  const { machineId, machine, service, notify, notifyError } = useMachineDetail();

  if (isLoading) return <SkeletonBar className="min-h-[320px] min-w-[320px] flex-1 rounded-xl" />;
  if (error) return <LoadErrorState message={error} onRetry={onRetry} className="flex-1 rounded-xl border border-borderGray" />;
  if (!diff) {
    return (
      <EmptyState
        icon="diff"
        title="Nothing to compare yet"
        description="Select two snapshots on the left to see what changed between them. With fewer than two, take a snapshot first."
        className="min-w-[320px] flex-1 rounded-xl border border-dashed border-borderGrayStrong"
      />
    );
  }

  const exportDiff = (format: DiffExportFormat) =>
    service
      .exportSnapshotDiff(machineId, diff.from.id, diff.to.id, format)
      .then((file) => {
        saveBlobAsFile(file, diffExportFileName(machine?.assetId ?? "machine", diff, format));
        notify(`Diff exported as ${format.toUpperCase()}`);
      })
      .catch((exportError: unknown) => notifyError(toApiErrorMessage(exportError, "Couldn't export the diff.")));

  const [fromDay, toDay] = [formatSnapshotDay(diff.from.takenAt), formatSnapshotDay(diff.to.takenAt)];
  return (
    <section className="flex min-w-[320px] flex-1 flex-col gap-2.5">
      <div className="flex items-baseline">
        <h2 className="text-base font-medium text-ink">Diff · {fromDay} → {toDay}</h2>
        <Tag tone={diff.rows.length ? "amber" : "default"} className="ml-auto">
          {diff.rows.length} {diff.rows.length === 1 ? "change" : "changes"}
        </Tag>
      </div>
      <Table>
        <TableHeaderRow>
          <TableHeaderCell>Before ({fromDay})</TableHeaderCell>
          <TableHeaderCell>After ({toDay})</TableHeaderCell>
        </TableHeaderRow>
        <div className="overflow-y-auto">
          {diff.rows.length === 0 && <p className="px-3.5 py-3 text-[15px] text-mutedGray">No changes between these snapshots.</p>}
          {diff.rows.map((row) => <DiffRowItem key={`${row.kind}-${row.componentName}`} row={row} />)}
          <UnchangedRows items={diff.unchanged} />
        </div>
      </Table>
      <div className="flex flex-wrap gap-2">
        <PermissionButton
          permission={PERMISSIONS.useAiAssistant}
          variant="primary"
          disabled={diff.rows.length === 0}
          onClick={() => router.push(buildAssistantHref(machineId, buildDiffQuestion(diff)))}
        >
          <Icon name="spark" />
          Ask AI: what could this cause?
        </PermissionButton>
        <ActionMenu
          label="the diff export"
          trigger={{ className: exportButtonClasses, content: <><Icon name="download" /> Export diff</> }}
          items={[
            { label: "Download CSV", icon: "file", onSelect: () => void exportDiff("csv") },
            { label: "Download PDF", icon: "download", onSelect: () => void exportDiff("pdf") },
          ]}
        />
      </div>
    </section>
  );
};
