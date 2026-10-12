import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { getMachineStatusMeta, toMachineStatus } from "@/lib/format/machineStatus";
import type { FleetMachine } from "@/lib/types/machineFleet";

interface MachinesTableProps {
  machines: FleetMachine[];
  // Shown in place of the rows when there are none.
  emptyMessage: string;
}

const formatHours = (hours: number | null) => (hours === null ? "—" : `${hours.toLocaleString()} h`);

export const MachinesTable = ({ machines, emptyMessage }: MachinesTableProps) => {
  return (
    <Table className="flex-1">
      <TableHeaderRow>
        <TableHeaderCell flex={2}>Asset</TableHeaderCell>
        <TableHeaderCell flex={1.4}>Make / model</TableHeaderCell>
        <TableHeaderCell>Site</TableHeaderCell>
        <TableHeaderCell>Hours</TableHeaderCell>
        <TableHeaderCell flex={0.9}>Status</TableHeaderCell>
      </TableHeaderRow>
      {machines.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-10 text-center text-[15px] text-mutedGray">
          {emptyMessage}
        </div>
      ) : (
        machines.map((machine) => {
          const status = getMachineStatusMeta(toMachineStatus(machine.status));
          return (
            <Link key={machine.id} href={`/machines/${machine.id}`}>
              <TableRow className="hover:bg-surfaceGray">
                <TableCell flex={2} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-11 flex-none items-center justify-center rounded-lg border border-borderGrayStrong bg-fillGray text-mutedGray">
                    <Icon name="image" className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium">{machine.label}</span>
                </TableCell>
                <TableCell flex={1.4} className="text-bodyGray">
                  {machine.manufacturer} {machine.model}
                </TableCell>
                <TableCell className="text-bodyGray">{machine.site ?? "—"}</TableCell>
                <TableCell className="text-bodyGray">{formatHours(machine.operatingHours)}</TableCell>
                <TableCell flex={0.9}>
                  <Tag tone={status.tone}>{status.label}</Tag>
                </TableCell>
              </TableRow>
            </Link>
          );
        })
      )}
    </Table>
  );
};
