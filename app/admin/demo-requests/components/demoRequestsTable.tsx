import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { getInitials } from "@/lib/format/nameInitials";
import { formatShortDateTime } from "@/lib/format/shortDate";
import type { DemoRequest } from "@/lib/types/demoRequest";
import { fullName, getStatusOption } from "../demoRequestLabels";

interface DemoRequestsTableProps {
  items: DemoRequest[];
  onOpen: (request: DemoRequest) => void;
}

export const DemoRequestsTable = ({ items, onOpen }: DemoRequestsTableProps) => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={1.5}>Name</TableHeaderCell>
        <TableHeaderCell flex={1.4}>Company</TableHeaderCell>
        <TableHeaderCell>Country</TableHeaderCell>
        <TableHeaderCell flex={1.6}>Email</TableHeaderCell>
        <TableHeaderCell flex={0.9}>Status</TableHeaderCell>
        <TableHeaderCell>Received</TableHeaderCell>
      </TableHeaderRow>
      {items.length === 0 && <div className="px-4 py-6 text-sm text-mutedGray">No demo requests match.</div>}
      {items.map((item) => {
        const statusOption = getStatusOption(item.status);
        return (
          <TableRow key={item.id} onClick={() => onOpen(item)} className="cursor-pointer hover:bg-fillGray">
            <TableCell flex={1.5} className="flex items-center gap-2.5">
              <Avatar initials={getInitials(fullName(item))} size="sm" />
              <span className="truncate font-medium">{fullName(item)}</span>
            </TableCell>
            <TableCell flex={1.4}>{item.company}</TableCell>
            <TableCell className="text-bodyGray">{item.country}</TableCell>
            <TableCell flex={1.6} className="text-bodyGray">
              {item.email}
            </TableCell>
            <TableCell flex={0.9}>
              <Tag tone={statusOption.tone}>{statusOption.label}</Tag>
            </TableCell>
            <TableCell className="text-bodyGray">{formatShortDateTime(item.createdAt)}</TableCell>
          </TableRow>
        );
      })}
    </Table>
  );
};
