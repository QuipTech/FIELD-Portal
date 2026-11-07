"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/actionMenu";
import { EmptyState } from "@/components/ui/emptyState";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { SavedToast } from "@/components/ui/savedToast";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { ClickableRow } from "@/components/ui/clickableRow";
import { Table, TableCell, TableHeaderCell, TableHeaderRow } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { MachineGroupBadge } from "@/components/machines/machineGroupBadge";
import { ManageMachineGroupsModal } from "@/components/machines/manageMachineGroupsModal";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { listMachineGroupsRequest } from "@/lib/api/adminMachineGroupsApi";
import type { MachineGroup, PlatformMachine } from "@/lib/types/machineGroup";
import { MachineGroupFormModal } from "./machineGroupFormModal";
import { DeleteMachineGroupDialog } from "./deleteMachineGroupDialog";
import { PlatformMachinePicker } from "./platformMachinePicker";

const SKELETON_ROWS = 4;

// Admin view → Machine groups: every global group with how many machines,
// organisations and people it covers. A row opens the group.
export const MachineGroupsDirectory = () => {
  const router = useRouter();
  const groups = useApiResource(listMachineGroupsRequest, [], "Couldn't load machine groups.");
  const [editing, setEditing] = useState<MachineGroup | "new" | null>(null);
  const [deleting, setDeleting] = useState<MachineGroup | null>(null);
  const [isFindingMachine, setIsFindingMachine] = useState(false);
  const [managing, setManaging] = useState<PlatformMachine | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const list = groups.data ?? [];

  const renderBody = () => {
    if (groups.error) return <LoadErrorState message={groups.error} onRetry={groups.reload} />;
    if (!groups.data)
      return Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="border-b border-borderGray px-4 py-4 last:border-b-0">
          <SkeletonBar className="h-4 w-1/3" />
        </div>
      ));
    if (list.length === 0)
      return (
        <EmptyState
          icon="layers"
          title="No machine groups yet"
          description="Create a group, add machines from any organisation, then share it with organisations or people."
        />
      );
    return list.map((group) => (
      <ClickableRow
        key={group.id}
        label={`Open ${group.name}`}
        onOpen={() => router.push(`/admin/machine-groups/${group.id}`)}
        className="flex cursor-pointer items-center gap-3 border-b border-borderGray px-4 py-3.5 last:border-b-0 hover:bg-fillGray"
      >
        <TableCell flex={3} className="flex flex-col gap-1">
          <MachineGroupBadge name={group.name} colour={group.colour} className="w-fit" />
          {group.description && <span className="truncate text-xs text-mutedGray">{group.description}</span>}
        </TableCell>
        <TableCell flex={1} className="text-bodyGray">
          {group.machineCount}
        </TableCell>
        <TableCell flex={1} className="text-bodyGray">
          {group.organisationCount}
        </TableCell>
        <TableCell flex={1} className="text-bodyGray">
          {group.userCount}
        </TableCell>
        <TableCell flex={0.4} className="flex justify-end">
          <ActionMenu
            label={group.name}
            items={[
              { label: "Edit", icon: "sliders", onSelect: () => setEditing(group) },
              { label: "Delete", icon: "x", tone: "danger", onSelect: () => setDeleting(group) },
            ]}
          />
        </TableCell>
      </ClickableRow>
    ));
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[22px] font-medium text-ink">Machine groups</h1>
          <p className="text-sm text-bodyGray">
            Share machines from any organisation with organisations or individual people.
          </p>
        </div>
        <Button variant="ghost" className="ml-auto" onClick={() => setIsFindingMachine(true)}>
          <Icon name="search" />
          Find a machine
        </Button>
        <Button variant="primary" onClick={() => setEditing("new")}>
          <Icon name="plus" />
          New group
        </Button>
      </div>
      <Table>
        <TableHeaderRow>
          <TableHeaderCell flex={3}>Name</TableHeaderCell>
          <TableHeaderCell flex={1}>Machines</TableHeaderCell>
          <TableHeaderCell flex={1}>Organisations</TableHeaderCell>
          <TableHeaderCell flex={1}>Users</TableHeaderCell>
          <TableHeaderCell flex={0.4}>{""}</TableHeaderCell>
        </TableHeaderRow>
        {renderBody()}
      </Table>
      {editing && (
        <MachineGroupFormModal
          group={editing === "new" ? null : editing}
          onSaved={(saved) => {
            setEditing(null);
            if (editing === "new") router.push(`/admin/machine-groups/${saved.id}`);
            else {
              setToast(`${saved.name} saved.`);
              groups.reload();
            }
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteMachineGroupDialog
          group={deleting}
          onDeleted={() => {
            setToast(`${deleting.name} was deleted.`);
            setDeleting(null);
            groups.reload();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
      {isFindingMachine && (
        <Modal title="Find a machine" onClose={() => setIsFindingMachine(false)} widthClassName="w-[620px]">
          <div className="p-5">
            <PlatformMachinePicker
              chooseOne={{
                label: "Manage groups",
                onChoose: (machine) => {
                  setIsFindingMachine(false);
                  setManaging(machine);
                },
              }}
            />
          </div>
        </Modal>
      )}
      {managing && (
        <ManageMachineGroupsModal
          machine={managing}
          onSaved={(message) => {
            setToast(message);
            groups.reload();
          }}
          onClose={() => setManaging(null)}
        />
      )}
      {toast && <SavedToast message={toast} onDismiss={dismissToast} />}
    </>
  );
};
