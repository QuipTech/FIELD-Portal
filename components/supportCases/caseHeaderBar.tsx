import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { getCasePriorityTone } from "@/lib/format/casePriority";
import { formatCaseNumber } from "@/lib/format/caseLabels";
import type { SupportCase } from "@/lib/types/supportCase";
import { CaseStatusBadge } from "./caseStatusBadge";

interface CaseHeaderBarProps {
  backHref: string;
  backLabel: string;
  caseNumber: number;
  // null while the case loads.
  item: SupportCase | null;
  audience: "customer" | "staff";
  isLive: boolean;
  actions?: ReactNode;
}

// "Support cases › #1042 Brake pressure alarm on cold start [P1] [Open]",
// then the screen's own buttons. Only a lost live connection is shown.
export const CaseHeaderBar = ({ backHref, backLabel, caseNumber, item, audience, isLive, actions }: CaseHeaderBarProps) => (
  <div className="flex flex-none items-center gap-3 border-b border-borderGray bg-surface px-6 py-4">
    <Link href={backHref} className="text-[17px] text-primary hover:underline">
      {backLabel}
    </Link>
    <Icon name="chevr" className="stroke-mutedGray" />
    <span className="truncate text-[17px] font-medium text-ink">
      {formatCaseNumber(caseNumber)} {item?.subject}
    </span>
    {item && (
      <>
        <Tag tone={getCasePriorityTone(item.priority)}>{item.priority}</Tag>
        <CaseStatusBadge status={item.status} audience={audience} />
        <div className="ml-auto flex flex-none items-center gap-2.5">
          {!isLive && (
            <span className="flex items-center gap-1.5 text-xs text-mutedGray" title="New messages will appear once reconnected">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Reconnecting…
            </span>
          )}
          {actions}
        </div>
      </>
    )}
  </div>
);
