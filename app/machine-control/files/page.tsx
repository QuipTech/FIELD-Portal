"use client";

import { useEffect, useState } from "react";
import { DesignSend } from "@/components/machineControl/designSend";
import { DesignUpload } from "@/components/machineControl/designUpload";
import { Button } from "@/components/ui/button";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getDesignDownload, listDesigns, type DesignVersion } from "@/lib/api/machineDesignApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { usePermissions } from "@/lib/auth/usePermissions";
import { useApiResource } from "@/lib/hooks/useApiResource";

const statusLabels = { waiting: "Waiting", downloading: "Downloading", arrived: "Arrived", failed: "Failed" };

export default function MachineControlFilesPage() {
  const { can } = usePermissions();
  const { data, error, reload } = useApiResource(listDesigns, [], "Could not load design files.");
  const [selected, setSelected] = useState<DesignVersion>();
  const [message, setMessage] = useState("");
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) reload(); }, 10_000);
    return () => clearInterval(timer);
  }, [reload]);

  async function download(version: DesignVersion, index: number) {
    setDownloadError("");
    try {
      const { url } = await getDesignDownload(requireAccessToken(), version.id, index);
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noreferrer";
      link.click();
    } catch (err) {
      setDownloadError(toApiErrorMessage(err, "Could not download the design file."));
    }
  }

  return (
    <div className="space-y-4">
      {can(PERMISSIONS.uploadMachineControlFiles) && (
        <DesignUpload onUploaded={(version) => {
          setSelected(version);
          setMessage(`${version.project} version uploaded.`);
          reload();
        }} />
      )}
      {message && <p role="status">{message}</p>}
      {error && <LoadErrorState message={error} onRetry={reload} />}
      {selected && can(PERMISSIONS.sendMachineControlFiles) && (
        <DesignSend key={selected.id} version={selected} onSent={() => {
          setMessage(`Delivery queued for ${selected.project}.`);
          setSelected(undefined);
          reload();
        }} />
      )}
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">Design library</h2>
        {!data && !error && <p>Loading design versions…</p>}
        {data?.versions.length === 0 && <p>No design versions uploaded yet.</p>}
        {downloadError && <p role="alert">{downloadError}</p>}
        {data?.versions.map((version) => (
          <div key={version.id} className="space-y-2 border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p><strong>{version.project}</strong> · {new Date(version.createdAt).toLocaleString()}</p>
              {can(PERMISSIONS.sendMachineControlFiles) && (
                <Button onClick={() => { setSelected(version); setMessage(""); }}>Send this version</Button>
              )}
            </div>
            <details>
              <summary>{version.files.length} files</summary>
              <ul className="space-y-1 pl-4">
                {version.files.map(({ path }, index) => (
                  <li key={path}><button type="button" className="text-left underline" onClick={() => download(version, index)}>{path}</button></li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </section>
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">Delivery history</h2>
        {data?.deliveries.length === 0 && <p>No deliveries yet.</p>}
        <ul className="divide-y">
          {data?.deliveries.map((delivery) => (
            <li key={delivery.id} className="space-y-1 py-2">
              <p><strong>{delivery.machineLabel}</strong>{delivery.site ? ` · ${delivery.site}` : ""} · {statusLabels[delivery.status]}</p>
              <p>{delivery.project} · Version uploaded {new Date(delivery.versionCreatedAt).toLocaleString()}</p>
              <p>Sent {new Date(delivery.createdAt).toLocaleString()}{delivery.status === "arrived" && ` · Arrived ${new Date(delivery.updatedAt).toLocaleString()}`}</p>
              {delivery.error && <p>{delivery.error}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
