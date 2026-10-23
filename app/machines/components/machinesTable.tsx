"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { ActivateMachineDialog, activationActionFor } from "@/components/machines/activateMachineDialog";
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

  // The row is a link; the button mustn't also open the machine.
  const startActivating = (event: MouseEvent, machine: FleetMachine) => {
    event.preventDefault();
    event.stopPropagation();
    setActivating(machine);
  };

  return (
    <>
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
