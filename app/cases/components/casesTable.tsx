import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { getCasePriorityTone } from "@/lib/format/casePriority";
import { getCaseCategoryIcon } from "@/lib/format/caseLabels";
import { formatElapsedTime } from "@/lib/format/elapsedTimeLabel";
import { getInitials } from "@/lib/format/nameInitials";
import type { SupportCase } from "@/lib/types/supportCase";

export const CasesTable = ({ cases }: { cases: SupportCase[] }) => {
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
      {cases.map((item) => (
        <Link key={item.id} href={`/cases/${item.caseNumber}`}>
          <TableRow className="hover:bg-surfaceGray">
            <TableCell flex={0.4} className="font-mono text-bodyGray">
              {item.caseNumber}
            </TableCell>
            <TableCell flex={3.2} className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-amberTint text-amber">
                <Icon name={getCaseCategoryIcon(item.category)} className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">{item.subject}</span>
            </TableCell>
            <TableCell flex={0.7} className="text-bodyGray">
              {item.machine?.label ?? "—"}
            </TableCell>
            <TableCell flex={1} className="flex items-center gap-2">
              {item.assignee ? (
                <>
                  <Avatar initials={getInitials(item.assignee.name)} size="sm" />
                  <span className="text-bodyGray">{item.assignee.name}</span>
                </>
              ) : (
                <span className="text-mutedGray">Unassigned</span>
              )}
            </TableCell>
            <TableCell flex={0.6}>
              <Tag tone={getCasePriorityTone(item.priority)}>{item.priority}</Tag>
            </TableCell>
            <TableCell flex={0.7} className="text-xs text-mutedGray">
              {formatElapsedTime(new Date(item.updatedAt))}
            </TableCell>
          </TableRow>
        </Link>
      ))}
    </Table>
  );
};
