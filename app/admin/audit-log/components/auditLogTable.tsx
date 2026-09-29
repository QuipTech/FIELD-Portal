import { Avatar } from "@/components/ui/avatar";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { getInitials } from "@/lib/format/nameInitials";
import { formatShortDateTime } from "@/lib/format/shortDate";
import type { AuditLogEvent, AuditSource } from "@/lib/types/auditLog";

const sourceLabels: Record<AuditSource, string> = {
  web: "Web",
  mobile: "Mobile",
  system: "System",
};

export const AuditLogTable = ({ events }: { events: AuditLogEvent[] }) => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={0.8}>Time</TableHeaderCell>
        <TableHeaderCell flex={1.1}>Actor</TableHeaderCell>
        <TableHeaderCell flex={1.3}>Action</TableHeaderCell>
        <TableHeaderCell flex={1.8}>Target</TableHeaderCell>
        <TableHeaderCell flex={0.7}>Source</TableHeaderCell>
      </TableHeaderRow>
      {events.length === 0 && <div className="px-4 py-6 text-sm text-mutedGray">No events match these filters.</div>}
      {events.map((event) => (
        <TableRow key={event.id}>
          <TableCell flex={0.8} className="text-xs text-mutedGray">
            <span title={event.occurredAt}>{formatShortDateTime(event.occurredAt)}</span>
          </TableCell>
          <TableCell flex={1.1} className="flex items-center gap-2">
            {event.actor ? (
              <>
                <Avatar
                  initials={getInitials(event.actor.name)}
                  imageSrc={event.actor.avatarUrl ?? undefined}
                  size="sm"
                />
                <span className="truncate text-bodyGray" title={event.organisationName}>
                  {event.actor.name}
                </span>
              </>
            ) : (
              <span className="text-bodyGray">System</span>
            )}
          </TableCell>
          <TableCell flex={1.3}>{event.actionLabel}</TableCell>
          <TableCell flex={1.8} className="text-bodyGray">
            <span title={event.target}>{event.target}</span>
          </TableCell>
          <TableCell flex={0.7} className="text-xs text-mutedGray">
            {event.source ? sourceLabels[event.source] : "—"}
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
};
