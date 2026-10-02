import { Card } from "@/components/ui/card";
import { formatAiCost } from "@/lib/format/aiCostLabel";
import type { AiUsageOverview, AiUsageSource } from "@/lib/types/aiConfiguration";

const SOURCE_LABELS: Record<AiUsageSource, string> = {
  indexing: "Document indexing",
  search: "Knowledge search",
  prompt_test: "Prompt tests",
};

const formatCount = (value: number) => value.toLocaleString("en-AU");

// Bedrock usage outside technician answers. Estimates: failed calls and
// retries aren't counted, so AWS billing stays the source of truth.
export const OtherAiUsageCard = ({ rows }: { rows: AiUsageOverview["otherUsage"] }) => {
  return (
    <Card className="gap-3">
      <h2 className="text-base font-medium text-ink">Other AI usage</h2>
      {rows.length === 0 && <span className="text-sm text-mutedGray">No indexing, search or prompt tests this period.</span>}
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.source} className="flex items-baseline gap-2.5">
            <span className="flex-1 truncate text-[15px] text-bodyGray">{SOURCE_LABELS[row.source]}</span>
            <span className="text-xs text-mutedGray">
              {formatCount(row.calls)} {row.calls === 1 ? "call" : "calls"} · {formatCount(row.tokens)} tokens
            </span>
            <span className="w-20 flex-none text-right text-sm text-ink">{formatAiCost(row.cost)}</span>
          </div>
        ))}
      </div>
      <p className="mt-auto text-xs text-mutedGray">Estimates. Your AWS bill shows the exact Bedrock cost.</p>
    </Card>
  );
};
