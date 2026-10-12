import type { IconName } from "@/components/icons/icon";
import { IconTile } from "@/components/ui/iconTile";
import type { RetentionPrinciple } from "@/lib/types/dataRetention";

const principleIcons: Record<RetentionPrinciple["icon"], IconName> = {
  database: "db",
  activity: "activity",
  shield: "shield",
};

export const RetentionPrinciplesList = ({ principles }: { principles: RetentionPrinciple[] }) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
      {principles.map((principle, index) => (
        <div
          key={principle.id}
          className={`flex items-center gap-3.5 px-5 py-4 ${index > 0 ? "border-t border-slate-200/80" : ""}`}
        >
          <IconTile icon={principleIcons[principle.icon]} />
          <span className="text-[15px] text-slate-700">{principle.text}</span>
        </div>
      ))}
    </div>
  );
};
