import { ReviewStatus } from '../dto/listReviewQueueQueryDto';
import { ReviewItemRow } from '../types/adminAiRows';
import { ReviewQueueItem } from '../types/adminAiResponse';

export const toReviewQueueItem = (row: ReviewItemRow): ReviewQueueItem => ({
  id: row.id,
  organisationName: row.organisation_name,
  question: row.question,
  answer: row.answer,
  reasonCode: row.reason_code,
  reason: row.reason,
  notes: row.notes,
  status: row.status,
  reviewer: row.reviewer_id
    ? {
        id: row.reviewer_id,
        name: row.reviewer_name ?? 'Deleted user',
        avatarUrl: row.reviewer_avatar,
      }
    : null,
  flaggedAt: row.flagged_at.toISOString(),
  reviewedAt: row.reviewed_at?.toISOString() ?? null,
});

// Who reviews the item after a status change. Picking an item up (or
// closing it) claims it for the actor unless someone already has it;
// returning it to unreviewed releases it. No status change keeps both.
export const resolveReviewAssignment = (
  current: { status: string; reviewerId: string | null },
  nextStatus: ReviewStatus | undefined,
  actorId: string,
): { status: string; reviewerId: string | null } => {
  if (!nextStatus) return current;
  if (nextStatus === 'unreviewed')
    return { status: nextStatus, reviewerId: null };
  return { status: nextStatus, reviewerId: current.reviewerId ?? actorId };
};
