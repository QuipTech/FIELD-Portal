import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { CasePriority } from "@/lib/types/dashboard";

const PRIORITY_COLORS: Record<CasePriority, string> = {
  P1: "bg-danger",
  P2: "bg-amber",
  P3: "bg-primary",
};
const PRIORITIES: CasePriority[] = ["P1", "P2", "P3"];

export const CasesByPriorityCard = ({ byPriority }: { byPriority: Record<CasePriority, number> }) => {
  const total = PRIORITIES.reduce((sum, priority) => sum + byPriority[priority], 0);

  return (
    <Card className="flex-1 gap-3">
      <div className="flex items-baseline">
        <h2 className="text-base font-medium text-ink">Open cases by priority</h2>
        <Link href="/cases" className="ml-auto text-xs text-primary">
          View cases
        </Link>
      </div>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-fillGray">
        {PRIORITIES.filter((priority) => byPriority[priority] > 0).map((priority) => (
          <div
            key={priority}
            style={{ width: `${(byPriority[priority] / total) * 100}%` }}
            className={PRIORITY_COLORS[priority]}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {PRIORITIES.map((priority) => (
          <div key={priority} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${PRIORITY_COLORS[priority]}`} />
            <span className="text-xs text-mutedGray">
              {priority} · {byPriority[priority]}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};
