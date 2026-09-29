import { Tag } from "@/components/ui/tag";
import type { Tone } from "@/components/ui/tone";
import type { DataSchemaRow, SchemaVisibilityLevel } from "@/lib/types/dataRetention";

// Neutral / amber / red, from least to most restricted.
const visibilityTone: Record<SchemaVisibilityLevel, Tone> = {
  all_tenants_read_only: "ok",
  own_rows_read_only: "amber",
  service_role_only: "danger",
};

const headerClasses = "min-w-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400";

// Sized to its rows — no filler space below the last one.
export const SchemaVisibilityTable = ({ schemas }: { schemas: DataSchemaRow[] }) => {
  return (
    <div className="self-start overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
      <div className="flex gap-4 bg-slate-50/50 px-4 py-3">
        <span className={`${headerClasses} flex-[1]`}>Schema</span>
        <span className={`${headerClasses} flex-[2.4]`}>Contents</span>
        <span className={`${headerClasses} flex-[1.4]`}>Tenant visibility</span>
      </div>
      {schemas.map((schema) => (
        <div key={schema.name} className="flex items-center gap-4 border-t border-slate-200/80 px-4 py-3.5">
          <span className="min-w-0 flex-[1] font-mono text-sm font-semibold text-slate-800">{schema.name}</span>
          <span className="min-w-0 flex-[2.4] text-sm text-slate-500">{schema.contents}</span>
          <span className="min-w-0 flex-[1.4]">
            <Tag tone={visibilityTone[schema.level]}>{schema.visibility}</Tag>
          </span>
        </div>
      ))}
    </div>
  );
};
