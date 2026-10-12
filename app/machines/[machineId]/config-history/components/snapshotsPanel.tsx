"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { EmptyState } from "@/components/ui/emptyState";
import { FilterChipSelect } from "@/components/ui/filterChipSelect";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Table, TableHeaderRow, TableHeaderCell } from "@/components/ui/table";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { formatSnapshotDateTime } from "@/lib/machineDetail/snapshotDiffText";
import type { Snapshot } from "@/lib/types/configurationDiff";
import { SnapshotRow } from "./snapshotRow";

interface SnapshotsPanelProps {
  snapshots: Snapshot[] | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedIds: string[];
  canCompare: boolean;
  onToggle: (snapshotId: string) => void;
  onCompare: () => void;
  onCompareWithLatest: (goodSnapshotId: string) => void;
  onToggleKnownGood: (snapshot: Snapshot) => void;
  onTakeSnapshot: () => Promise<void>;
}

const SnapshotsBody = (props: SnapshotsPanelProps & { canMarkGood: boolean }) => {
  const { snapshots, isLoading, error, onRetry, selectedIds, onToggle, onToggleKnownGood, canMarkGood } = props;
  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading snapshots" className="flex flex-col gap-3 p-4">
        {[0, 1, 2, 3, 4].map((row) => <SkeletonBar key={row} className="h-6 w-full" />)}
      </div>
    );
  }
  if (error) return <LoadErrorState message={error} onRetry={onRetry} />;
  if (!snapshots?.length) {
    return (
      <EmptyState
        icon="camera"
        title="No snapshots yet"
        description="A snapshot records every component's serial and firmware. Take one now, and later ones show what changed."
      />
    );
  }
  return (
    <>
      {snapshots.map((snapshot) => (
        <SnapshotRow
          key={snapshot.id}
          snapshot={snapshot}
          isSelected={selectedIds.includes(snapshot.id)}
          onToggle={() => onToggle(snapshot.id)}
          onToggleKnownGood={() => onToggleKnownGood(snapshot)}
          canMarkGood={canMarkGood}
        />
      ))}
    </>
  );
};

export const SnapshotsPanel = (props: SnapshotsPanelProps) => {
  const { isLoaded, can } = usePermissions();
  const [isTaking, setIsTaking] = useState(false);
  const goodSnapshots = (props.snapshots ?? []).filter((snapshot, index) => snapshot.isKnownGood && index > 0);

  const takeSnapshot = () => {
    setIsTaking(true);
    props.onTakeSnapshot().finally(() => setIsTaking(false));
  };

  return (
    <section className="flex min-w-[320px] flex-[1.05] flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-medium text-ink">Snapshots</h2>
        <span className="text-xs text-mutedGray">Select two to compare</span>
        <PermissionButton permission={PERMISSIONS.addHistoryEntry} size="sm" className="ml-auto" disabled={isTaking} onClick={takeSnapshot}>
          <Icon name="camera" className="h-3.5 w-3.5" />
          {isTaking ? "Taking…" : "Take snapshot"}
        </PermissionButton>
      </div>
      <Table>
        <TableHeaderRow>
          <TableHeaderCell flex={0.4}>Cmp</TableHeaderCell>
          <TableHeaderCell flex={1.2}>Date</TableHeaderCell>
          <TableHeaderCell>Taken by</TableHeaderCell>
          <TableHeaderCell flex={1.3}>Trigger</TableHeaderCell>
        </TableHeaderRow>
        <div className="overflow-y-auto">
          <SnapshotsBody {...props} canMarkGood={isLoaded && can(PERMISSIONS.manageMachine)} />
        </div>
      </Table>
      <div className="flex items-center">
        <Button variant="primary" disabled={!props.canCompare} onClick={props.onCompare}>
          <Icon name="diff" />
          Compare selected ({props.selectedIds.length})
        </Button>
        {goodSnapshots.length > 0 && (
          <FilterChipSelect
            label="Compare the latest snapshot with one marked good"
            className="ml-auto"
            value=""
            onChange={(snapshotId) => snapshotId && props.onCompareWithLatest(snapshotId)}
            options={[
              { value: "", label: "Last known good" },
              ...goodSnapshots.map((snapshot) => ({ value: snapshot.id, label: formatSnapshotDateTime(snapshot.takenAt) })),
            ]}
          />
        )}
      </div>
    </section>
  );
};
