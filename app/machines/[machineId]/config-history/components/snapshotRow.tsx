import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Avatar } from "@/components/ui/avatar";
import { TableRow, TableCell } from "@/components/ui/table";
import { getInitials } from "@/lib/format/nameInitials";
import { formatSnapshotDateTime, snapshotTriggerLabels } from "@/lib/machineDetail/snapshotDiffText";
import type { Snapshot } from "@/lib/types/configurationDiff";

interface SnapshotRowProps {
  snapshot: Snapshot;
  isSelected: boolean;
  onToggle: () => void;
  onToggleKnownGood: () => void;
  canMarkGood: boolean;
}

export const SnapshotRow = ({ snapshot, isSelected, onToggle, onToggleKnownGood, canMarkGood }: SnapshotRowProps) => (
  <TableRow className={`transition-colors ${isSelected ? "bg-primaryTint" : "hover:bg-surfaceGray"}`}>
    <TableCell flex={0.4}>
      <button
        type="button"
        role="checkbox"
        aria-checked={isSelected}
        aria-label={`Compare snapshot from ${formatSnapshotDateTime(snapshot.takenAt)}`}
        onClick={onToggle}
        className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full ${
          isSelected ? "bg-primary text-white" : "border border-borderGrayStrong"
        }`}
      >
        {isSelected && <Icon name="check" className="h-3 w-3" />}
      </button>
    </TableCell>
    <TableCell flex={1.2} className={isSelected ? "font-medium" : undefined}>
      <button type="button" onClick={onToggle} className="text-left">
        {formatSnapshotDateTime(snapshot.takenAt)}
      </button>
    </TableCell>
    <TableCell className="flex items-center gap-2">
      {snapshot.takenBy && (
        <Avatar initials={getInitials(snapshot.takenBy.name)} imageSrc={snapshot.takenBy.avatarUrl ?? undefined} size="sm" />
      )}
      <span className="truncate">{snapshot.takenBy?.name ?? "System"}</span>
    </TableCell>
    <TableCell flex={1.3} className="flex items-center gap-1.5">
      <Tag>{snapshotTriggerLabels[snapshot.trigger]}</Tag>
      <button
        type="button"
        onClick={onToggleKnownGood}
        disabled={!canMarkGood}
        aria-pressed={snapshot.isKnownGood}
        title={snapshot.isKnownGood ? "Known good — click to unmark" : "Mark as known good"}
        className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border disabled:cursor-not-allowed ${
          snapshot.isKnownGood ? "border-primaryBorder bg-primaryTint text-primary" : "border-transparent text-mutedGray hover:border-borderGrayStrong"
        } ${!canMarkGood && !snapshot.isKnownGood ? "invisible" : ""}`}
      >
        <Icon name="shield" className="h-3.5 w-3.5" />
      </button>
    </TableCell>
  </TableRow>
);
