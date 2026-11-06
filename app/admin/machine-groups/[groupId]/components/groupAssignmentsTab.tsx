"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow } from "@/components/ui/table";
import { ShareAccessLevelTag } from "@/components/machines/shareAccessLevelTag";
import { ReasonConfirmDialog } from "@/components/machines/reasonConfirmDialog";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { formatDayMonth } from "@/lib/format/elapsedTimeLabel";
import { listGroupAssignmentsRequest, revokeGroupAssignmentRequest } from "@/lib/api/adminMachineGroupsApi";
import type { GroupAssignment } from "@/lib/types/machineGroup";
import { AssignGroupModal } from "./assignGroupModal";

interface GroupAssignmentsTabProps {
  groupId: string;
  onChanged: (message: string) => void;
}

// Who the group is shared with: whole organisations or individual people,
// at View or Contribute. Revoking needs a reason and applies on their next
// page load.
export const GroupAssignmentsTab = ({ groupId, onChanged }: GroupAssignmentsTabProps) => {
  const assignments = useApiResource(
    (token) => listGroupAssignmentsRequest(token, groupId),
    [groupId],
    "Couldn't load who this group is shared with.",
  );
  const [isAssigning, setIsAssigning] = useState(false);
  const [revoking, setRevoking] = useState<GroupAssignment | null>(null);
  const list = assignments.data ?? [];

  const renderRows = () => {
    if (assignments.error) return <LoadErrorState message={assignments.error} onRetry={assignments.reload} />;
    if (!assignments.data) return <SkeletonBar className="m-4 h-4 w-1/2" />;
    if (list.length === 0)
      return (
        <EmptyState
          icon="users"
          title="Not shared yet"
          description="Assign the group to an organisation or a person."
        />
      );
    return list.map((assignment) => (
      <TableRow key={assignment.id}>
        <TableCell flex={2} className="flex items-center gap-2">
          <Icon
            name={assignment.targetType === "organisation" ? "globe" : "user"}
            className="h-4 w-4 stroke-mutedGray"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{assignment.targetName}</span>
            {assignment.targetType === "user" && (
              <span className="truncate text-xs text-mutedGray">
                {assignment.targetEmail} · {assignment.organisation.name}
              </span>
            )}
          </span>
        </TableCell>
        <TableCell flex={1}>
          <ShareAccessLevelTag level={assignment.accessLevel} />
        </TableCell>
        <TableCell flex={1.2} className="text-xs text-bodyGray">
          {assignment.grantedByName ?? "—"} · {formatDayMonth(new Date(assignment.grantedAt))}
        </TableCell>
        <TableCell flex={0.6} className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => setRevoking(assignment)}>
            Revoke
          </Button>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <>
      <div className="flex">
        <Button variant="primary" className="ml-auto" onClick={() => setIsAssigning(true)}>
          <Icon name="plus" />
          Assign
        </Button>
      </div>
      <Table>
        <TableHeaderRow>
          <TableHeaderCell flex={2}>Organisation or user</TableHeaderCell>
          <TableHeaderCell flex={1}>Access</TableHeaderCell>
          <TableHeaderCell flex={1.2}>Granted</TableHeaderCell>
          <TableHeaderCell flex={0.6}>{""}</TableHeaderCell>
        </TableHeaderRow>
        {renderRows()}
      </Table>
      {isAssigning && (
        <AssignGroupModal
          groupId={groupId}
          onAssigned={(name) => {
            setIsAssigning(false);
            assignments.reload();
            onChanged(`Shared with ${name}.`);
          }}
          onClose={() => setIsAssigning(false)}
        />
      )}
      {revoking && (
        <ReasonConfirmDialog
          title={`Revoke ${revoking.targetName}'s access?`}
          confirmLabel="Revoke access"
          failedMessage="Couldn't revoke access. Please try again."
          onConfirm={async (reason) => {
            await revokeGroupAssignmentRequest(requireAccessToken(), { groupId, assignmentId: revoking.id }, reason);
            setRevoking(null);
            assignments.reload();
            onChanged(`${revoking.targetName} no longer has this group.`);
          }}
          onClose={() => setRevoking(null)}
        >
          <p>They stop seeing this group&apos;s machines on their next page load.</p>
        </ReasonConfirmDialog>
      )}
    </>
  );
};
