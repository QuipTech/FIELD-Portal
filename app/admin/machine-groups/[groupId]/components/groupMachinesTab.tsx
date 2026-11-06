"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { EmptyState } from "@/components/ui/emptyState";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { Tag } from "@/components/ui/tag";
import { Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { listGroupMachinesRequest, removeGroupMachineRequest } from "@/lib/api/adminMachineGroupsApi";
import type { GroupMachine } from "@/lib/types/machineGroup";
import { AddMachinesModal } from "./addMachinesModal";

interface GroupMachinesTabProps {
  groupId: string;
  onChanged: (message: string) => void;
}

const STATUS_LABELS: Record<string, string> = { running: "Running", down: "Down", service_due: "Service due" };

// The group's machines with their OWNING organisation; adding searches
// every organisation, removing stops sharing that machine through the group.
export const GroupMachinesTab = ({ groupId, onChanged }: GroupMachinesTabProps) => {
  const machines = useApiResource(
    (token) => listGroupMachinesRequest(token, groupId),
    [groupId],
    "Couldn't load the machines.",
  );
  const [isAdding, setIsAdding] = useState(false);
  const [removing, setRemoving] = useState<GroupMachine | null>(null);
  const list = machines.data ?? [];

  const renderRows = () => {
    if (machines.error) return <LoadErrorState message={machines.error} onRetry={machines.reload} />;
    if (!machines.data) return <SkeletonBar className="m-4 h-4 w-1/2" />;
    if (list.length === 0)
      return (
        <EmptyState icon="truck" title="No machines in this group" description="Add machines from any organisation." />
      );
    return list.map((machine) => (
      <TableRow key={machine.id}>
        <TableCell flex={1.2} className="font-medium">
          {machine.label}
        </TableCell>
        <TableCell flex={1.5} className="text-bodyGray">{`${machine.manufacturer} ${machine.model}`}</TableCell>
        <TableCell flex={1.5}>{machine.owningOrganisation.name}</TableCell>
        <TableCell flex={1}>
          <Tag>{STATUS_LABELS[machine.status] ?? machine.status}</Tag>
        </TableCell>
        <TableCell flex={0.6} className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => setRemoving(machine)}>
            Remove
          </Button>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <>
      <div className="flex">
        <Button variant="primary" className="ml-auto" onClick={() => setIsAdding(true)}>
          <Icon name="plus" />
          Add machines
        </Button>
      </div>
      <Table>
        <TableHeaderRow>
          <TableHeaderCell flex={1.2}>Plant ID</TableHeaderCell>
          <TableHeaderCell flex={1.5}>Model</TableHeaderCell>
          <TableHeaderCell flex={1.5}>Owning organisation</TableHeaderCell>
          <TableHeaderCell flex={1}>Status</TableHeaderCell>
          <TableHeaderCell flex={0.6}>{""}</TableHeaderCell>
        </TableHeaderRow>
        {renderRows()}
      </Table>
      {isAdding && (
        <AddMachinesModal
          groupId={groupId}
          existingIds={list.map((machine) => machine.id)}
          onAdded={(count) => {
            setIsAdding(false);
            machines.reload();
            onChanged(`${count} ${count === 1 ? "machine" : "machines"} added.`);
          }}
          onClose={() => setIsAdding(false)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.label}?`}
          confirmLabel="Remove machine"
          onConfirm={async () => {
            await removeGroupMachineRequest(requireAccessToken(), groupId, removing.id);
            setRemoving(null);
            machines.reload();
            onChanged(`${removing.label} removed.`);
          }}
          onClose={() => setRemoving(null)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't remove the machine. Please try again.")}
        >
          <p>
            Everyone this group is shared with stops seeing {removing.label} on their next page load. It stays with{" "}
            {removing.owningOrganisation.name}.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
};
