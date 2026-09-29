import { Card } from "@/components/ui/card";
import type { AiUsageOverview } from "@/lib/types/aiConfiguration";

export const UsageByOrganisationCard = ({ rows }: { rows: AiUsageOverview["usageByOrganisation"] }) => {
  return (
    <Card className="gap-3">
      <h2 className="text-base font-medium text-ink">Usage by organisation</h2>
      {rows.length === 0 && <span className="text-sm text-mutedGray">No queries this period.</span>}
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.organisationId} className="flex items-center gap-2.5">
            <span className="w-[120px] flex-none truncate text-[15px] text-bodyGray" title={row.name}>
              {row.name}
            </span>
            <span className="h-2 flex-1 rounded-full bg-fillGray">
              <span style={{ width: `${row.sharePercent}%` }} className="block h-full rounded-full bg-primary" />
            </span>
            <span className="w-12 flex-none text-right text-xs text-mutedGray">
              {row.queries.toLocaleString("en-AU")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};
