import { IconTile } from "@/components/ui/iconTile";
import { retentionPrinciples } from "@/lib/mockData/dataRetention";

export const RetentionPrinciplesList = () => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      {retentionPrinciples.map((principle, index) => (
        <div
          key={principle.id}
          className={`flex items-center gap-3.5 px-5 py-4 ${index > 0 ? "border-t border-slate-200/80" : ""}`}
        >
          <IconTile icon={principle.icon} />
          <span className="text-[15px] text-slate-700">{principle.text}</span>
        </div>
      ))}
    </div>
  );
};
