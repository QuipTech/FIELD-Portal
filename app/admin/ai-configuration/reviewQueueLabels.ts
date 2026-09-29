import type { Tone } from "@/components/ui/tone";
import type { ReviewReasonCode, ReviewStatus } from "@/lib/types/aiConfiguration";

export const REVIEW_STATUS_OPTIONS: { status: ReviewStatus; label: string; tone: Tone }[] = [
  { status: "unreviewed", label: "Unreviewed", tone: "amber" },
  { status: "in_review", label: "In review", tone: "default" },
  { status: "resolved", label: "Resolved", tone: "primary" },
  { status: "escalated", label: "Escalated", tone: "danger" },
];

export const getReviewStatusMeta = (status: ReviewStatus) =>
  REVIEW_STATUS_OPTIONS.find((option) => option.status === status) ?? REVIEW_STATUS_OPTIONS[0];

const reasonLabels: Record<ReviewReasonCode, string> = {
  no_source: "No source found",
  low_confidence: "Low confidence",
  marked_wrong: "Answer marked wrong",
  safety_refusal: "Safety refusal",
};

export const getReviewReasonLabel = (reasonCode: ReviewReasonCode | null, reason: string | null): string =>
  (reasonCode ? reasonLabels[reasonCode] : reason) ?? "—";
