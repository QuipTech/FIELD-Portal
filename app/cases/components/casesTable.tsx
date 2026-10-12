import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { CaseStatusBadge } from "@/components/supportCases/caseStatusBadge";
import { getCasePriorityTone } from "@/lib/format/casePriority";
import { formatCaseNumber, getCaseCategoryIcon } from "@/lib/format/caseLabels";
import { formatElapsedTime } from "@/lib/format/elapsedTimeLabel";
import { getInitials } from "@/lib/format/nameInitials";
import type { SupportCase } from "@/lib/types/supportCase";

export const CasesTable = ({ cases }: { cases: SupportCase[] }) => {
  return (
    <Table>
      <TableHeaderRow>
        <TableHeaderCell flex={3.2}>Subject</TableHeaderCell>
        <TableHeaderCell flex={1}>Status</TableHeaderCell>
        <TableHeaderCell flex={0.6}>Priority</TableHeaderCell>
        <TableHeaderCell flex={1.3}>Assigned to</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Updated</TableHeaderCell>
      </TableHeaderRow>
      {cases.map((item) => (
        <Link key={item.id} href={`/cases/${item.caseNumber}`}>
          <TableRow className="hover:bg-surfaceGray">
            <TableCell flex={3.2} className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-amberTint text-amber">
                <Icon name={getCaseCategoryIcon(item.category)} className="h-3.5 w-3.5" />
              </span>
              <span className="truncate font-medium">{item.subject}</span>
              <span className="flex-none font-mono text-xs text-mutedGray">{formatCaseNumber(item.caseNumber)}</span>
            </TableCell>
            <TableCell flex={1}>
              <CaseStatusBadge status={item.status} audience="customer" />
            </TableCell>
            <TableCell flex={0.6}>
              <Tag tone={getCasePriorityTone(item.priority)}>{item.priority}</Tag>
            </TableCell>
            <TableCell flex={1.3} className="flex items-center gap-2">
              {item.assignee ? (
                <>
                  <Avatar initials={getInitials(item.assignee.name)} imageSrc={item.assignee.avatarUrl ?? undefined} size="sm" />
                  <span className="truncate text-bodyGray">{item.assignee.name}</span>
                </>
              ) : (
                <span className="text-mutedGray">Awaiting assignment</span>
              )}
            </TableCell>
            <TableCell flex={0.8} className="text-xs text-mutedGray">
              {formatElapsedTime(new Date(item.updatedAt))}
            </TableCell>
          </TableRow>
        </Link>
      ))}
    </Table>
  );
};
