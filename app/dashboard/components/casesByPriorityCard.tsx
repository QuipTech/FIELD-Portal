import { Card } from "@/components/ui/card";

const priorityBreakdown = [
  { label: "P1 · 2", widthPercent: 29, colorClass: "bg-danger" },
  { label: "P2 · 3", widthPercent: 43, colorClass: "bg-amber" },
  { label: "P3 · 2", widthPercent: 28, colorClass: "bg-primary" },
];

export const CasesByPriorityCard = () => {
  return (
    <Card className="flex-1 gap-3">
      <h2 className="text-base font-medium text-ink">Open cases by priority</h2>
      <div className="flex h-3.5 overflow-hidden rounded-full">
        {priorityBreakdown.map((segment) => (
          <div key={segment.label} style={{ width: `${segment.widthPercent}%` }} className={segment.colorClass} />
        ))}
      </div>
      <div className="flex justify-between">
        {priorityBreakdown.map((segment) => (
          <div key={segment.label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${segment.colorClass}`} />
            <span className="text-xs text-mutedGray">{segment.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
