"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { listDesignTargets, previewDesign, sendDesign, type DesignPreview, type DesignVersion, type PreviewRequest } from "@/lib/api/machineDesignApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { useApiResource } from "@/lib/hooks/useApiResource";

export function DesignSend({ version, onSent }: { version: DesignVersion; onSent: () => void }) {
  const targets = useApiResource(listDesignTargets, [], "Could not load delivery destinations.");
  const [machineIds, setMachineIds] = useState<string[]>([]);
  const [siteKey, setSiteKey] = useState("");
  const [review, setReview] = useState<{ request: PreviewRequest; preview: DesignPreview; batchId: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (targets.error) return <LoadErrorState message={targets.error} onRetry={targets.reload} />;
  if (!targets.data) return <p>Loading destinations…</p>;
  if (!targets.data.length) return <p>No eligible paired tablets are available for delivery.</p>;

  const sites = new Map<string, { label: string; count: number }>();
  for (const { tenantId, site, organisation } of targets.data) {
    if (!site) continue;
    const key = JSON.stringify([tenantId, site]);
    sites.set(key, { label: `${site} · ${organisation}`, count: (sites.get(key)?.count ?? 0) + 1 });
  }
  const destination = siteKey ? JSON.parse(siteKey) as [string, string] : null;

  async function preview() {
    const request: PreviewRequest = destination
      ? { versionId: version.id, siteTenantId: destination[0], site: destination[1] }
      : { versionId: version.id, machineIds };
    setBusy(true);
    setError("");
    setReview(undefined);
    try {
      const result = await previewDesign(requireAccessToken(), request);
      setReview({ request, preview: result, batchId: crypto.randomUUID() });
    } catch (err) {
      setError(toApiErrorMessage(err, "Could not preview the delivery."));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!review) return;
    setBusy(true);
    setError("");
    try {
      await sendDesign(requireAccessToken(), {
        ...review.request, previewHash: review.preview.previewHash, batchId: review.batchId,
      });
      setReview(undefined);
      onSent();
    } catch (err) {
      setError(toApiErrorMessage(err, "Could not send the design version."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Send {version.project}</h2>
      <label className="block">
        Target
        <select className="ml-2 rounded-md border bg-white p-2" value={siteKey} disabled={busy}
          onChange={(event) => { setSiteKey(event.target.value); setReview(undefined); }}>
          <option value="">Select machines</option>
          {Array.from(sites).map(([key, { label, count }]) => (
            <option key={key} value={key}>{label} ({count} {count === 1 ? "tablet" : "tablets"})</option>
          ))}
        </select>
      </label>
      {destination ? <p>Includes eligible paired tablets at this site.</p> : (
        <fieldset className="max-h-48 space-y-1 overflow-auto" disabled={busy}>
          <legend>Machines</legend>
          {targets.data.map((target) => (
            <label className="flex gap-2" key={target.machineId}>
              <input type="checkbox" checked={machineIds.includes(target.machineId)}
                onChange={(event) => {
                  setMachineIds(event.target.checked
                    ? [...machineIds, target.machineId] : machineIds.filter((id) => id !== target.machineId));
                  setReview(undefined);
                }}
              />
              {target.label}{target.site ? ` · ${target.site}` : ""} · {target.organisation}
            </label>
          ))}
        </fieldset>
      )}
      <Button onClick={preview} disabled={busy || (!destination && !machineIds.length)}>Review delivery</Button>
      {review && (
        <div className="space-y-3 rounded-lg border p-3">
          <h3 className="font-semibold">Delivery preview</h3>
          <p>Every destination will receive this version’s {review.preview.version.files.length} files.</p>
          <ul className="list-disc pl-5">
            {review.preview.version.files.map(({ path }) => <li key={path}>{path}</li>)}
          </ul>
          {review.preview.targets.map(({ deviceId, label, site, replaces }) => (
            <div key={deviceId}>
              <p className="font-medium">{label}{site ? ` · ${site}` : ""}</p>
              {replaces ? (
                <details>
                  <summary>
                    {replaces.status === "arrived"
                      ? `Replaces ${replaces.paths.length} active files`
                      : `Replaces ${replaces.paths.length} files if the preceding delivery arrives`}
                  </summary>
                  <ul className="list-disc pl-5">{replaces.paths.map((path) => <li key={path}>{path}</li>)}</ul>
                </details>
              ) : <p>First delivery of this project to this tablet.</p>}
            </div>
          ))}
          <Button onClick={send} disabled={busy}>{busy ? "Sending…" : "Confirm send"}</Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
