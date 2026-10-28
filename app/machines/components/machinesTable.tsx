"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { ActivateMachineDialog, activationActionFor } from "@/components/machines/activateMachineDialog";
import { BulkActivateDialog } from "@/components/machines/bulkActivateDialog";
import { getMachineStatusMeta, toMachineStatus } from "@/lib/format/machineStatus";
import type { FleetMachine } from "@/lib/types/machineFleet";

interface MachinesTableProps {
  machines: FleetMachine[];
  // Shown in place of the rows when there are none.
  emptyMessage: string;
  // After a machine is activated from its row.
  onActivated: () => void;
}

const formatHours = (hours: number | null) => (hours === null ? "—" : `${hours.toLocaleString()} h`);

// availableActions is only filled in for callers with machine.lifecycle.
const canActivate = (machine: FleetMachine) =>
  Boolean(machine.availableActions?.some((action) => action === "activate" || action === "reactivate"));

export const MachinesTable = ({ machines, emptyMessage, onActivated }: MachinesTableProps) => {
  const [activating, setActivating] = useState<FleetMachine | null>(null);
  // Machines ticked for activating together.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActivating, setIsBulkActivating] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const selected = machines.filter((machine) => selectedIds.has(machine.id) && canActivate(machine));

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

  return (
    <>
      {(selected.length > 0 || bulkNotice) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primaryBorder bg-primaryTint px-3 py-2 text-sm text-primaryTintText">
          {selected.length > 0 ? (
            <>
              <span>{selected.length} selected</span>
              <Button size="sm" variant="primary" onClick={() => setIsBulkActivating(true)}>
                Activate {selected.length}
              </Button>
              <button type="button" className="underline" onClick={() => setSelectedIds(new Set())}>Clear</button>
            </>
          ) : (
            <span role="status">{bulkNotice}</span>
          )}
        </div>
      )}
      <Table className="flex-1">
        <TableHeaderRow>
          <TableHeaderCell flex={2}>Asset</TableHeaderCell>
          <TableHeaderCell flex={1.4}>Make / model</TableHeaderCell>
          <TableHeaderCell>Site</TableHeaderCell>
          <TableHeaderCell>Hours</TableHeaderCell>
          <TableHeaderCell flex={0.9}>Status</TableHeaderCell>
          <TableHeaderCell flex={0.9}> </TableHeaderCell>
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
                    {canActivate(machine) && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${machine.label} to activate`}
                        checked={selectedIds.has(machine.id)}
                        onClick={(event) => toggleSelected(event, machine.id)}
                        onChange={() => undefined}
                        className="h-4 w-4 flex-none accent-primary"
                      />
                    )}
                    <span className="flex h-8 w-11 flex-none items-center justify-center rounded-lg border border-borderGrayStrong bg-fillGray text-mutedGray">
                      <Icon name="image" className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate font-medium">{machine.label}</span>
                    {isInactive && <Tag tone="amber">Not active</Tag>}
                  </TableCell>
                  <TableCell flex={1.4} className="text-bodyGray">
                    {machine.manufacturer} {machine.model}
                  </TableCell>
                  <TableCell className="text-bodyGray">{machine.site ?? "—"}</TableCell>
                  <TableCell className="text-bodyGray">{formatHours(machine.operatingHours)}</TableCell>
                  <TableCell flex={0.9}>
                    <Tag tone={status.tone}>{status.label}</Tag>
                  </TableCell>
                  <TableCell flex={0.9}>
                    {canActivate(machine) && (
                      <Button size="sm" variant="primary" onClick={(event) => startActivating(event, machine)}>
                        Activate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              </Link>
            );
          })
        )}
      </Table>
      {isBulkActivating && (
        <BulkActivateDialog
          machines={selected.map((machine) => ({ id: machine.id, lifecycleState: machine.lifecycleState! }))}
          onDone={({ activated, failures }) => {
            setIsBulkActivating(false);
            setSelectedIds(new Set());
            setBulkNotice(
              `${activated} machine${activated === 1 ? "" : "s"} activated.` +
                (failures.length ? ` ${failures.length} couldn't be: ${failures[0]}` : ""),
            );
            onActivated();
          }}
          onClose={() => setIsBulkActivating(false)}
        />
      )}
      {activating?.lifecycleState && activationActionFor(activating.lifecycleState) && (
        <ActivateMachineDialog
          machineId={activating.id}
          machineLabel={activating.label}
          lifecycleState={activating.lifecycleState}
          onActivated={onActivated}
          onClose={() => setActivating(null)}
        />
      )}
    </>
  );
};
