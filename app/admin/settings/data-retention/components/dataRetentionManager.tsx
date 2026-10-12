"use client";

import { Button } from "@/components/ui/button";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { getDataRetentionRequest, updateAiLogRetentionRequest } from "@/lib/api/dataRetentionApi";
import { SchemaVisibilityTable } from "./schemaVisibilityTable";
import { RetentionPrinciplesList } from "./retentionPrinciplesList";
import { AiLogRetentionCard } from "./aiLogRetentionCard";
import { DataRetentionSkeleton } from "./dataRetentionSkeleton";

const codeClasses = "rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px]";

export const DataRetentionManager = () => {
  const settings = useApiResource(getDataRetentionRequest, [], "Couldn't load data & retention settings.");
  const { data } = settings;

  // Rejects with the API's error so the card can show it.
  const saveRetention = async (months: number) => {
    settings.setData(await updateAiLogRetentionRequest(requireAccessToken(), months));
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">Settings · Data &amp; retention</span>
        <h1 className="text-xl font-bold text-slate-900">Data &amp; retention</h1>
      </div>
      {settings.isLoading && !data && <DataRetentionSkeleton />}
      {settings.error && !data && (
        <div className="flex items-center gap-3 rounded-2xl border border-dangerBorder bg-dangerTint p-4">
          <span className="flex-1 text-sm text-danger">{settings.error}</span>
          <Button size="sm" onClick={settings.reload}>
            Try again
          </Button>
        </div>
      )}
      {data && (
        <>
          <div className="flex flex-col">
            <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-800">Schema visibility</h2>
            <SchemaVisibilityTable schemas={data.schemas} />
          </div>
          <div>
            <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-800">Retention principles</h2>
            <RetentionPrinciplesList principles={data.principles} />
          </div>
          <AiLogRetentionCard
            months={data.retention.aiQueryLogsMonths}
            allowedMonths={data.retention.allowedMonths}
            onSave={saveRetention}
          />
          <p className="text-xs text-mutedGray">
            Row-level security enforces the tenant boundary on the <code className={codeClasses}>app</code> schema; the{" "}
            <code className={codeClasses}>billing</code> schema sits outside tenant RLS entirely and only the service
            role can reach it.
          </p>
        </>
      )}
    </>
  );
};
