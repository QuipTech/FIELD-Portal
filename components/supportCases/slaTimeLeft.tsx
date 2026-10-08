import { Tag } from "@/components/ui/tag";
import { describeCaseSla } from "@/lib/format/caseSlaLabel";
import type { CaseStatus } from "@/lib/types/supportCase";

interface SlaTimeLeftProps {
  slaDueAt: string | null;
  slaPausedAt: string | null;
  status: CaseStatus;
  // "badge": always a tag (amber while running), as on the case panel.
  variant?: "text" | "badge";
}

const ACTIVE_STATUSES: CaseStatus[] = ["new", "open", "waiting_on_customer"];

// Time left on the case's response target; a red "Breached" once past due.
export const SlaTimeLeft = ({ slaDueAt, slaPausedAt, status, variant = "text" }: SlaTimeLeftProps) => {
  const sla = describeCaseSla(slaDueAt, slaPausedAt, ACTIVE_STATUSES.includes(status));
  if (!sla) return <span className="text-sm text-mutedGray">—</span>;
  if (sla.kind === "breached") return <Tag tone="danger">{sla.label}</Tag>;
  if (variant === "badge") return <Tag tone={sla.kind === "paused" ? "default" : "amber"}>{sla.label}</Tag>;
  return <span className="text-sm text-mutedGray">{sla.label}</span>;
};
