import { Avatar } from "@/components/ui/avatar";
import { IconTile } from "@/components/ui/iconTile";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { reviewQueue } from "@/lib/mockData/aiConfiguration";
import type { ReviewQueueStatus } from "@/lib/mockData/aiConfiguration";
import type { Tone } from "@/components/ui/tone";

const statusTone: Record<ReviewQueueStatus, Tone> = {
  Unreviewed: "amber",
  "In review": "default",
  Resolved: "primary",
  Escalated: "danger",
};

export const ReviewQueueTable = () => {
  return (
    <Table className="flex-none">
      <TableHeaderRow>
        <TableHeaderCell flex={3.4}>Flagged question</TableHeaderCell>
        <TableHeaderCell flex={1.1}>Reason</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Status</TableHeaderCell>
        <TableHeaderCell flex={1.1}>Reviewer</TableHeaderCell>
        <TableHeaderCell flex={0.7}>Flagged</TableHeaderCell>
      </TableHeaderRow>
      {reviewQueue.map((item) => (
        <TableRow key={item.id}>
          <TableCell flex={3.4} className="flex items-center gap-2.5">
            <IconTile icon={item.flagged ? "alert" : "msg"} tone={item.flagged ? "amber" : "default"} size="sm" />
            <span className="font-medium">{item.question}</span>
          </TableCell>
          <TableCell flex={1.1} className="text-bodyGray">{item.reason}</TableCell>
          <TableCell flex={0.8}>
            <Tag tone={statusTone[item.status]}>{item.status}</Tag>
          </TableCell>
          <TableCell flex={1.1} className="flex items-center gap-2">
            {item.reviewerInitials ? (
              <>
                <Avatar initials={item.reviewerInitials} size="sm" />
                <span className="text-bodyGray">{item.reviewerName}</span>
              </>
            ) : (
              <span className="text-bodyGray">—</span>
            )}
          </TableCell>
          <TableCell flex={0.7} className="text-xs text-mutedGray">{item.flaggedLabel}</TableCell>
        </TableRow>
      ))}
    </Table>
  );
};
