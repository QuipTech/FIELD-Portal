"use client";

import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { useMachineDetail } from "../machineDetailContext";
import { useSnapshotComparison } from "./useSnapshotComparison";
import { SnapshotsPanel } from "./components/snapshotsPanel";
import { DiffPanel } from "./components/diffPanel";
import type { Snapshot } from "@/lib/types/configurationDiff";

// Configuration history tab: answers "what changed since it last worked".
const MachineConfigHistoryPage = () => {
  const { machineId, service, notify, notifyError } = useMachineDetail();
  const comparison = useSnapshotComparison(service, machineId);

  const takeSnapshot = () =>
    comparison
      .takeSnapshot()
      .then(() => notify("Snapshot taken"))
      .catch((error: unknown) => notifyError(toApiErrorMessage(error, "Couldn't take a snapshot.")));

  const toggleKnownGood = (snapshot: Snapshot) =>
    void comparison
      .toggleKnownGood(snapshot)
      .catch((error: unknown) => notifyError(toApiErrorMessage(error, "Couldn't update the snapshot.")));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-borderGray bg-surface p-5">
      <div className="flex flex-wrap items-stretch gap-4">
        <SnapshotsPanel
          snapshots={comparison.snapshots.data}
          isLoading={comparison.snapshots.isLoading}
          error={comparison.snapshots.error}
          onRetry={comparison.snapshots.reload}
          selectedIds={comparison.selectedIds}
          canCompare={comparison.canCompare}
          onToggle={comparison.toggleSnapshot}
          onCompare={comparison.compareSelected}
          onCompareWithLatest={comparison.compareWithLatest}
          onToggleKnownGood={toggleKnownGood}
          onTakeSnapshot={takeSnapshot}
        />
        <DiffPanel
          diff={comparison.diff.data}
          isLoading={comparison.snapshots.isLoading || comparison.diff.isLoading}
          error={comparison.diff.error}
          onRetry={comparison.diff.reload}
        />
      </div>
      <p className="text-xs text-mutedGray">
        Answers &ldquo;what changed since it last worked&rdquo; — snapshots are taken automatically on component swap,
        service and schedule, and manually by technicians.
      </p>
    </div>
  );
};

export default MachineConfigHistoryPage;
