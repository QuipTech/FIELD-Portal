import type { ReactNode } from "react";
import { Tag } from "@/components/ui/tag";

interface PlanCardProps {
  name: string;
  badgeLabel: string;
  badgeTone: "default" | "primary";
  billingNote: string;
  features: string[];
  highlighted?: boolean;
  action: ReactNode;
}

export const PlanCard = ({ name, badgeLabel, badgeTone, billingNote, features, highlighted, action }: PlanCardProps) => {
  return (
    <div
      className={`flex flex-1 flex-col gap-2.5 rounded-xl border bg-white p-3.5 ${
        highlighted ? "border-primary ring-2 ring-primaryTint" : "border-borderGray"
      }`}
    >
      <div className="flex items-baseline">
        <span className="text-[17px] font-medium text-ink">{name}</span>
        <Tag tone={badgeTone} className="ml-auto">{badgeLabel}</Tag>
      </div>
      <span className="text-xs text-mutedGray">{billingNote}</span>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {features.map((feature) => (
          <span key={feature} className="text-sm text-bodyGray">✓ {feature}</span>
        ))}
      </div>
      <div className="mt-auto">{action}</div>
    </div>
  );
};
