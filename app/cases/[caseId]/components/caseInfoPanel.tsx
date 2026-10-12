import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";
import { CaseStatusBadge } from "@/components/supportCases/caseStatusBadge";
import { getCasePriorityTone } from "@/lib/format/casePriority";
import { CASE_PRIORITIES } from "@/lib/format/caseLabels";
import { formatShortDateTime } from "@/lib/format/shortDate";
import { getInitials } from "@/lib/format/nameInitials";
import type { SupportCase } from "@/lib/types/supportCase";

const InfoRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">{label}</span>
    <div className="text-[15px] text-ink">{children}</div>
  </div>
);

const priorityLabel = (item: SupportCase) =>
  CASE_PRIORITIES.find((option) => option.value === item.priority)?.label ?? item.priority;

// Read-only: only QuipTech support assigns a case or changes its status
// or priority.
export const CaseInfoPanel = ({ item }: { item: SupportCase }) => (
  <aside className="flex w-[260px] flex-none flex-col gap-4 rounded-2xl border border-borderGray bg-surfaceGray p-4">
    <InfoRow label="Status">
      <CaseStatusBadge status={item.status} audience="customer" />
    </InfoRow>
    <InfoRow label="Priority">
      <Tag tone={getCasePriorityTone(item.priority)}>{priorityLabel(item)}</Tag>
    </InfoRow>
    <InfoRow label="Assigned to">
      {item.assignee ? (
        <span className="flex items-center gap-2">
          <Avatar initials={getInitials(item.assignee.name)} imageSrc={item.assignee.avatarUrl ?? undefined} size="md" />
          {item.assignee.name}
        </span>
      ) : (
        <span className="text-mutedGray">Awaiting assignment</span>
      )}
    </InfoRow>
    <InfoRow label="Created by">{item.reporter?.name ?? "Former user"}</InfoRow>
    <InfoRow label="Created">{formatShortDateTime(item.createdAt)}</InfoRow>
    <InfoRow label="Machine">
      {item.machine ? (
        [item.machine.label, item.machine.modelName].filter(Boolean).join(" · ")
      ) : (
        <span className="text-mutedGray">No specific machine</span>
      )}
    </InfoRow>
    {item.resolvedAt && <InfoRow label="Resolved">{formatShortDateTime(item.resolvedAt)}</InfoRow>}
  </aside>
);
