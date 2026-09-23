import { RetentionPrinciplesList } from "./components/retentionPrinciplesList";
import { SchemaVisibilityTable } from "./components/schemaVisibilityTable";

const RetentionSettingsPage = () => {
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">Settings · Data &amp; retention</span>
        <h1 className="text-xl font-bold text-slate-900">Data &amp; retention</h1>
      </div>
      <div>
        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-800">Schema visibility</h2>
        <SchemaVisibilityTable />
      </div>
      <div>
        <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-800">Retention principles</h2>
        <RetentionPrinciplesList />
      </div>
      <p className="text-xs text-mutedGray">
        Row-level security enforces the tenant boundary on the{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px]">app</code> schema; the{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px]">billing</code> schema sits outside
        tenant RLS entirely.
      </p>
    </>
  );
};

export default RetentionSettingsPage;
