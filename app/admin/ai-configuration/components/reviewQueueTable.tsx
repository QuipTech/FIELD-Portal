import { Avatar } from "@/components/ui/avatar";
import { IconTile } from "@/components/ui/iconTile";
import { Tag } from "@/components/ui/tag";
import { Table, TableHeaderRow, TableHeaderCell, TableRow, TableCell } from "@/components/ui/table";
import { getInitials } from "@/lib/format/nameInitials";
import { formatShortDate } from "@/lib/format/shortDate";
import type { ReviewQueueItem } from "@/lib/types/aiConfiguration";
import { getReviewReasonLabel, getReviewStatusMeta } from "../reviewQueueLabels";

interface ReviewQueueTableProps {
  items: ReviewQueueItem[];
  onOpen: (item: ReviewQueueItem) => void;
}

export const ReviewQueueTable = ({ items, onOpen }: ReviewQueueTableProps) => {
  return (
    <Table className="flex-none">
      <TableHeaderRow>
        <TableHeaderCell flex={3.4}>Flagged question</TableHeaderCell>
        <TableHeaderCell flex={1.1}>Reason</TableHeaderCell>
        <TableHeaderCell flex={0.8}>Status</TableHeaderCell>
        <TableHeaderCell flex={1.1}>Reviewer</TableHeaderCell>
        <TableHeaderCell flex={0.7}>Flagged</TableHeaderCell>
      </TableHeaderRow>
      {items.length === 0 && <div className="px-4 py-6 text-sm text-mutedGray">Nothing here right now.</div>}
      {items.map((item) => {
        const needsAttention = item.status === "unreviewed" || item.status === "escalated";
        const statusMeta = getReviewStatusMeta(item.status);
        return (
          <TableRow key={item.id} onClick={() => onOpen(item)} className="cursor-pointer hover:bg-fillGray">
            <TableCell flex={3.4} className="flex items-center gap-2.5">
              <IconTile
                icon={needsAttention ? "alert" : "msg"}
                tone={item.status === "escalated" ? "danger" : needsAttention ? "amber" : "default"}
                size="sm"
              />
              <span className="truncate font-medium">
                {item.question ? `“${item.question}”` : "(question unavailable)"}
              </span>
            </TableCell>
            <TableCell flex={1.1} className="text-bodyGray">
              {getReviewReasonLabel(item.reasonCode, item.reason)}
            </TableCell>
            <TableCell flex={0.8}>
              <Tag tone={statusMeta.tone}>{statusMeta.label}</Tag>
            </TableCell>
            <TableCell flex={1.1} className="flex items-center gap-2">
              {item.reviewer ? (
                <>
                  <Avatar
                    initials={getInitials(item.reviewer.name)}
                    imageSrc={item.reviewer.avatarUrl ?? undefined}
                    size="sm"
                  />
                  <span className="truncate text-bodyGray">{item.reviewer.name}</span>
                </>
              ) : (
                <span className="text-bodyGray">—</span>
              )}
            </TableCell>
            <TableCell flex={0.7} className="text-xs text-mutedGray">
              {formatShortDate(item.flaggedAt)}
            </TableCell>
          </TableRow>
        );
      })}
    </Table>
  );
};
