import { Tag } from "@/components/ui/tag";
import { CASE_STATUS_LABELS, CASE_STATUS_TONES, CUSTOMER_CASE_STATUS_LABELS } from "@/lib/format/caseLabels";
import type { CaseStatus } from "@/lib/types/supportCase";

interface CaseStatusBadgeProps {
  status: CaseStatus;
  // Customers read "Waiting on you" and "Awaiting assignment".
  audience?: "customer" | "staff";
}

export const CaseStatusBadge = ({ status, audience = "staff" }: CaseStatusBadgeProps) => {
  const labels = audience === "customer" ? CUSTOMER_CASE_STATUS_LABELS : CASE_STATUS_LABELS;
  return <Tag tone={CASE_STATUS_TONES[status]}>{labels[status]}</Tag>;
};
