import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow } from "@/components/ui/table";
import { CaseStatusBadge } from "@/components/supportCases/caseStatusBadge";
import { SlaTimeLeft } from "@/components/supportCases/slaTimeLeft";
import { getCasePriorityTone } from "@/lib/format/casePriority";
import { formatElapsedTime } from "@/lib/format/elapsedTimeLabel";
import type { AdminSupportCaseListItem } from "@/lib/types/adminSupportCase";
import { CasePersonCell } from "./casePersonCell";

const COLUMNS = { number: 0.5, subject: 2.2, company: 1.2, reporter: 1.1, assignee: 1.2, status: 1.1, priority: 0.6, sla: 0.9, updated: 0.9 };

export const CaseQueueTable = ({ items }: { items: AdminSupportCaseListItem[] }) => (
  <Table className="flex-none">
    <TableHeaderRow>
      <TableHeaderCell flex={COLUMNS.number}>#</TableHeaderCell>
      <TableHeaderCell flex={COLUMNS.subject}>Subject</TableHeaderCell>
      <TableHeaderCell flex={COLUMNS.company}>Company</TableHeaderCell>
      <TableHeaderCell flex={COLUMNS.reporter}>Reporter</TableHeaderCell>
      <TableHeaderCell flex={COLUMNS.assignee}>Assignee</TableHeaderCell>
      <TableHeaderCell flex={COLUMNS.status}>Status</TableHeaderCell>
      <TableHeaderCell flex={COLUMNS.priority}>Priority</TableHeaderCell>
      <TableHeaderCell flex={COLUMNS.sla}>SLA</TableHeaderCell>
      <TableHeaderCell flex={COLUMNS.updated}>Updated</TableHeaderCell>
    </TableHeaderRow>
    {items.map((item) => (
      <Link key={item.id} href={`/admin/cases/${item.caseNumber}`}>
        <TableRow className="hover:bg-surfaceGray">
          <TableCell flex={COLUMNS.number} className="text-bodyGray">
            {item.caseNumber}
          </TableCell>
          <TableCell flex={COLUMNS.subject} className="flex items-center gap-2">
            {item.isUnread && <span className="h-2 w-2 flex-none rounded-full bg-primary" aria-label="Unread" />}
            <span className="truncate font-medium">{item.subject}</span>
          </TableCell>
          <TableCell flex={COLUMNS.company} className="text-bodyGray">
            {item.company.name}
          </TableCell>
          <TableCell flex={COLUMNS.reporter}>
            {item.reporterName ? <CasePersonCell name={item.reporterName} /> : <span className="text-mutedGray">Former user</span>}
          </TableCell>
          <TableCell flex={COLUMNS.assignee}>
            {item.assignee ? (
              <CasePersonCell name={item.assignee.name} avatarUrl={item.assignee.avatarUrl} />
            ) : (
              <Tag tone="amber">
                <Icon name="user" className="h-3.5 w-3.5" />
                Unassigned
              </Tag>
            )}
          </TableCell>
          <TableCell flex={COLUMNS.status}>
            <CaseStatusBadge status={item.status} />
          </TableCell>
          <TableCell flex={COLUMNS.priority}>
            <Tag tone={getCasePriorityTone(item.priority)}>{item.priority}</Tag>
          </TableCell>
          <TableCell flex={COLUMNS.sla}>
            <SlaTimeLeft slaDueAt={item.slaDueAt} slaPausedAt={item.slaPausedAt} status={item.status} />
          </TableCell>
          <TableCell flex={COLUMNS.updated} className="text-bodyGray">
            {formatElapsedTime(new Date(item.updatedAt))}
          </TableCell>
        </TableRow>
      </Link>
    ))}
  </Table>
);
