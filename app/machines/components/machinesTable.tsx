import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { machines } from "@/lib/mockData/machines";
import { getMachineStatusMeta } from "@/lib/format/machineStatus";

interface MachinesTableProps {
  query: string;
}

export const MachinesTable = ({ query }: MachinesTableProps) => {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredMachines = normalizedQuery
    ? machines.filter((machine) =>
        [machine.id, machine.model, machine.site].some((field) =>
          field.toLowerCase().includes(normalizedQuery),
        ),
      )
    : machines;

  return (
    <Table className="flex-1">
      <TableHeaderRow>
        <TableHeaderCell flex={2}>Asset</TableHeaderCell>
        <TableHeaderCell flex={1.4}>Make / model</TableHeaderCell>
        <TableHeaderCell>Site</TableHeaderCell>
        <TableHeaderCell>Hours</TableHeaderCell>
        <TableHeaderCell flex={0.9}>Status</TableHeaderCell>
      </TableHeaderRow>
      {filteredMachines.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[15px] text-mutedGray">
          No machines match &ldquo;{query}&rdquo;
        </div>
      ) : (
        filteredMachines.map((machine) => {
          const status = getMachineStatusMeta(machine.status);
          return (
            <Link key={machine.id} href={`/machines/${machine.id}`}>
              <TableRow className="hover:bg-surfaceGray">
                <TableCell flex={2} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-11 flex-none items-center justify-center rounded-lg border border-borderGrayStrong bg-fillGray text-mutedGray">
                    <Icon name="image" className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium">{machine.id}</span>
                </TableCell>
                <TableCell flex={1.4} className="text-bodyGray">{machine.model}</TableCell>
                <TableCell className="text-bodyGray">{machine.site}</TableCell>
                <TableCell className="text-bodyGray">{machine.hours.toLocaleString()} h</TableCell>
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
