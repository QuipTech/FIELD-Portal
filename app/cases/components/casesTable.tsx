import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { supportCases } from "@/lib/mockData/cases";
import { getCasePriorityTone } from "@/lib/format/casePriority";

export const CasesTable = () => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={0.4}>#</TableHeaderCell>
        <TableHeaderCell flex={3.2}>Subject</TableHeaderCell>
        <TableHeaderCell flex={0.7}>Asset</TableHeaderCell>
        <TableHeaderCell flex={1}>Assignee</TableHeaderCell>
        <TableHeaderCell flex={0.6}>Priority</TableHeaderCell>
        <TableHeaderCell flex={0.7}>Updated</TableHeaderCell>
      </TableHeaderRow>
      {supportCases.map((item) => (
        <Link key={item.id} href={`/cases/${item.id}`}>
          <TableRow className="hover:bg-surfaceGray">
            <TableCell flex={0.4} className="font-mono text-bodyGray">{item.id}</TableCell>
            <TableCell flex={3.2} className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-amberTint text-amber">
                <Icon name={item.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">{item.subject}</span>
            </TableCell>
            <TableCell flex={0.7} className="text-bodyGray">{item.assetId}</TableCell>
            <TableCell flex={1} className="flex items-center gap-2">
              <Avatar initials={item.assignee.initials} size="sm" />
              <span className="text-bodyGray">{item.assignee.name}</span>
            </TableCell>
            <TableCell flex={0.6}>
              <Tag tone={getCasePriorityTone(item.priority)}>{item.priority}</Tag>
            </TableCell>
            <TableCell flex={0.7} className="text-xs text-mutedGray">{item.updatedLabel}</TableCell>
          </TableRow>
        </Link>
      ))}
    </Table>
  );
};
