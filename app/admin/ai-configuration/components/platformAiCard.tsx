import { Icon } from "@/components/icons/icon";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import type { AiPlatformInfo } from "@/lib/types/aiConfiguration";

const rowLabelClasses = "w-[88px] flex-none text-xs font-medium uppercase tracking-wide text-mutedGray";
const rowClasses = "flex items-center gap-2.5 border-b border-borderGray py-2 last:border-b-0";

export const PlatformAiCard = ({ platform }: { platform: AiPlatformInfo }) => {
  return (
    <Card className="gap-3">
      <div className="flex items-center">
        <h2 className="text-base font-medium text-ink">Platform AI</h2>
        <Tag className="ml-auto">
          <Icon name="lock" className="h-3.5 w-3.5" />
          Locked
        </Tag>
      </div>
      <div className={rowClasses}>
        <span className={rowLabelClasses}>Provider</span>
        <span className="text-[15px] text-ink">{platform.provider}</span>
        <Tag className="ml-auto">{platform.region}</Tag>
      </div>
      {platform.models.map((model) => (
        <div key={model.role} className={rowClasses}>
          <span className={rowLabelClasses}>{model.role}</span>
          <span className="text-[15px] text-ink" title={model.modelId}>
            {model.label}
          </span>
          <span className="ml-auto text-xs text-mutedGray">{model.purpose}</span>
        </div>
      ))}
      <p className="text-xs text-mutedGray">
        Read-only. Platform-managed for every tenant — no keys, endpoints or model selection here.
      </p>
    </Card>
  );
};
