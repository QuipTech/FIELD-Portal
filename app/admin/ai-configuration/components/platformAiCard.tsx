import { Icon } from "@/components/icons/icon";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

const rows = [
  { label: "Provider", value: "Amazon Bedrock", note: "Platform-managed" },
  { label: "Answers", value: "Claude Sonnet 4.5", note: "technician queries" },
  { label: "Background", value: "Claude Haiku 4.5", note: "indexing, summaries" },
];

export const PlatformAiCard = () => {
  return (
    <Card className="gap-3">
      <div className="flex items-center">
        <h2 className="text-base font-medium text-ink">Platform AI</h2>
        <Tag className="ml-auto">
          <Icon name="lock" className="h-3.5 w-3.5" />
          Locked
        </Tag>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2.5 border-b border-borderGray py-2 last:border-b-0">
          <span className="w-[88px] flex-none text-xs font-medium uppercase tracking-wide text-mutedGray">
            {row.label}
          </span>
          <span className="text-[15px] text-ink">{row.value}</span>
          <span className="ml-auto text-xs text-mutedGray">{row.note}</span>
        </div>
      ))}
      <p className="text-xs text-mutedGray">
        Read-only. Platform-managed for every tenant — no keys, endpoints or model selection here.
      </p>
    </Card>
  );
};
