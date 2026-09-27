import { Tag } from "@/components/ui/tag";
import { schemaVisibilityRows } from "@/lib/mockData/dataRetention";

export const SchemaVisibilityTable = () => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
      <div className="flex gap-4 bg-slate-50/50 px-4 py-3">
        <span className="min-w-0 flex-[1] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Schema
        </span>
        <span className="min-w-0 flex-[2.4] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Contents
        </span>
        <span className="min-w-0 flex-[1.4] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Tenant visibility
        </span>
      </div>
      {schemaVisibilityRows.map((row) => (
        <div key={row.schema} className="flex items-center gap-4 border-t border-slate-200/80 px-4 py-3.5">
          <span className="min-w-0 flex-[1] text-sm font-semibold text-slate-800">{row.schema}</span>
          <span className="min-w-0 flex-[2.4] text-sm text-slate-500">{row.contents}</span>
          <span className="min-w-0 flex-[1.4]">
            <Tag tone={row.visibilityTone}>{row.visibilityLabel}</Tag>
          </span>
        </div>
      ))}
    </div>
  );
};
