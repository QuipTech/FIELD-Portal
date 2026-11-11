"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { MachineSharingBadges } from "@/components/machines/machineSharingBadges";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { ActivateMachineDialog, activationActionFor } from "@/components/machines/activateMachineDialog";
import { BulkActivateDialog } from "@/components/machines/bulkActivateDialog";
import { ConnectMachineAppDialog } from "@/components/machines/machineApp/connectMachineAppDialog";
import { MoveToGroupDialog } from "@/components/machines/moveToGroupDialog";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { usePermissions } from "@/lib/auth/usePermissions";
import { getMachineStatusMeta, toMachineStatus } from "@/lib/format/machineStatus";
import { canContributeTo } from "@/lib/machineDetail/machineAccessRules";
import { machineAppPagePath } from "@/lib/types/machineAppConnection";
import type { FleetMachine } from "@/lib/types/machineFleet";
import { MachineRowPhotos } from "./machineRowPhotos";
import { MachinesBulkBar } from "./machinesBulkBar";
import { ConnectMachineAppButton } from "./connectMachineAppButton";

interface MachinesTableProps {
  machines: FleetMachine[];
  // Shown in place of the rows when there are none.
  emptyMessage: string;
  // After machines are activated or moved between groups.
  onChanged: () => void;
}

const formatHours = (hours: number | null) => (hours === null ? "—" : `${hours.toLocaleString()} h`);

// availableActions is only filled in for callers with machine.lifecycle.
const canActivate = (machine: FleetMachine) =>
  Boolean(machine.availableActions?.some((action) => action === "activate" || action === "reactivate"));

export const MachinesTable = ({ machines, emptyMessage, onChanged }: MachinesTableProps) => {
  const router = useRouter();
  const [activating, setActivating] = useState<FleetMachine | null>(null);
  const [connecting, setConnecting] = useState<FleetMachine | null>(null);
  // Machines ticked for activating together.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActivating, setIsBulkActivating] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  // Machines to move between groups; platform administrators only.
  const [moving, setMoving] = useState<FleetMachine[] | null>(null);
  const { isLoaded, can } = usePermissions();
  const canMoveGroups = isLoaded && can(PERMISSIONS.managePlatform);
  // Ticked for activating together, or (platform administrators) moving.
  const isSelectable = (machine: FleetMachine) => canMoveGroups || canActivate(machine);
  const selected = machines.filter((machine) => selectedIds.has(machine.id) && isSelectable(machine));
  const selectedToActivate = selected.filter(canActivate);

  const finishBulkAction = (notice: string) => {
    setSelectedIds(new Set());
    setBulkNotice(notice);
    onChanged();
  };

  const toggleSelected = (event: MouseEvent, machineId: string) => {
    event.stopPropagation();
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(machineId)) next.delete(machineId);
      else next.add(machineId);
      return next;
    });
  };

  // The row is a link; the button mustn't also open the machine.
  const startActivating = (event: MouseEvent, machine: FleetMachine) => {
    event.preventDefault();
    event.stopPropagation();
    setActivating(machine);
  };
  const startMoving = (event: MouseEvent, machine: FleetMachine) => {
    event.preventDefault();
    event.stopPropagation();
    setMoving([machine]);
  };

  return (
    <>
      <MachinesBulkBar
        selectedCount={selected.length}
        activatableCount={selectedToActivate.length}
        notice={bulkNotice}
        onActivate={() => setIsBulkActivating(true)}
        onMoveToGroup={canMoveGroups ? () => setMoving(selected) : undefined}
        onClear={() => setSelectedIds(new Set())}
      />
      <Table className="flex-1">
        <TableHeaderRow>
          <TableHeaderCell flex={2}>Asset</TableHeaderCell>
          <TableHeaderCell flex={1.4}>Make / model</TableHeaderCell>
          <TableHeaderCell>Groups</TableHeaderCell>
          <TableHeaderCell>Site</TableHeaderCell>
          <TableHeaderCell>Hours</TableHeaderCell>
          <TableHeaderCell flex={0.9}>Status</TableHeaderCell>
          <TableHeaderCell flex={2.2}> </TableHeaderCell>
        </TableHeaderRow>
        {machines.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-10 text-center text-[15px] text-mutedGray">
            {emptyMessage}
          </div>
        ) : (
          machines.map((machine) => {
            const status = getMachineStatusMeta(toMachineStatus(machine.status));
            const isInactive = machine.lifecycleState !== undefined && machine.lifecycleState !== "active";
            return (
              <Link key={machine.id} href={`/machines/${machine.id}`}>
                <TableRow className="hover:bg-surfaceGray">
                  <TableCell flex={2} className="flex items-center gap-2.5">
                    {isSelectable(machine) && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${machine.label}`}
                        checked={selectedIds.has(machine.id)}
                        onClick={(event) => toggleSelected(event, machine.id)}
                        onChange={() => undefined}
                        className="h-4 w-4 flex-none accent-primary"
                      />
                    )}
                    <MachineRowPhotos machine={machine} />
                    <span className="truncate font-medium">{machine.label}</span>
                    {isInactive && <Tag tone="amber">Not active</Tag>}
                  </TableCell>
                  <TableCell flex={1.4} className="text-bodyGray">
                    {machine.manufacturer} {machine.model}
                  </TableCell>
                  <TableCell className="min-w-0 text-bodyGray">
                    <MachineSharingBadges machine={machine} />
                  </TableCell>
                  <TableCell className="text-bodyGray">{machine.site ?? "—"}</TableCell>
                  <TableCell className="text-bodyGray">{formatHours(machine.operatingHours)}</TableCell>
                  <TableCell flex={0.9}>
                    <Tag tone={status.tone}>{status.label}</Tag>
                  </TableCell>
                  <TableCell flex={2.2} className="flex flex-wrap items-center justify-end gap-1.5 !overflow-visible">
                    {canActivate(machine) && (
                      <Button size="sm" variant="primary" onClick={(event) => startActivating(event, machine)}>
                        Activate
                      </Button>
                    )}
                    {canMoveGroups && (
                      <Button size="sm" variant="ghost" onClick={(event) => startMoving(event, machine)}>
                        Move to group
                      </Button>
                    )}
                    {canContributeTo(machine) && (
                      <ConnectMachineAppButton
                        isConnected={Boolean(machine.appConnected)}
                        onClick={() => (machine.appConnected ? router.push(machineAppPagePath(machine.id)) : setConnecting(machine))}
                      />
                    )}
                  </TableCell>
                </TableRow>
              </Link>
            );
          })
        )}
      </Table>
      {connecting && (
        <ConnectMachineAppDialog
          machineId={connecting.id}
          machineLabel={connecting.label}
          onConnected={() => router.push(machineAppPagePath(connecting.id))}
          onClose={() => setConnecting(null)}
        />
      )}
      {moving && (
        <MoveToGroupDialog
          machines={moving.map((machine) => ({ id: machine.id, label: machine.label }))}
          onMoved={finishBulkAction}
          onClose={() => setMoving(null)}
        />
      )}
      {isBulkActivating && (
        <BulkActivateDialog
          machines={selectedToActivate.map((machine) => ({ id: machine.id, lifecycleState: machine.lifecycleState! }))}
          onDone={({ activated, failures }) => {
            setIsBulkActivating(false);
            finishBulkAction(
              `${activated} machine${activated === 1 ? "" : "s"} activated.` +
                (failures.length ? ` ${failures.length} couldn't be: ${failures[0]}` : ""),
            );
          }}
          onClose={() => setIsBulkActivating(false)}
        />
      )}
      {activating?.lifecycleState && activationActionFor(activating.lifecycleState) && (
        <ActivateMachineDialog
          machineId={activating.id}
          machineLabel={activating.label}
          lifecycleState={activating.lifecycleState}
          onActivated={onChanged}
          onClose={() => setActivating(null)}
        />
      )}
    </>
  );
};
