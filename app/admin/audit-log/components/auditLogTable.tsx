import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { auditLogEntries } from "@/lib/mockData/auditLog";

export const AuditLogTable = () => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={0.8}>Time</TableHeaderCell>
        <TableHeaderCell flex={1.1}>Actor</TableHeaderCell>
        <TableHeaderCell flex={1.3}>Action</TableHeaderCell>
        <TableHeaderCell flex={1.8}>Target</TableHeaderCell>
        <TableHeaderCell flex={0.7}>Source</TableHeaderCell>
      </TableHeaderRow>
      {auditLogEntries.map((entry) => (
        <TableRow key={entry.id}>
          <TableCell flex={0.8} className="text-xs text-mutedGray">{entry.timeLabel}</TableCell>
          <TableCell flex={1.1} className="flex items-center gap-2">
            <Avatar initials={entry.actorInitials} size="sm" />
            <span className="text-bodyGray">{entry.actorName}</span>
          </TableCell>
          <TableCell flex={1.3}>{entry.action}</TableCell>
          <TableCell flex={1.8} className="text-bodyGray">{entry.target}</TableCell>
          <TableCell flex={0.7} className="text-xs text-mutedGray">{entry.source}</TableCell>
        </TableRow>
      ))}
    </Table>
  );
};
