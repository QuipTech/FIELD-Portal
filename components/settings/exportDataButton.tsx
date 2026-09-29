"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getDataExportRequest, requestDataExportRequest } from "@/lib/api/myDataApi";

// While an export is being built, check back this often.
const POLL_MS = 10_000;

// Requests an export (built in the background) and, once it's ready,
// offers the download link.
export const ExportDataButton = () => {
  const latest = useApiResource(getDataExportRequest, [], "Couldn't check your export.");
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const exportStatus = latest.data;
  const isInProgress = exportStatus?.status === "queued" || exportStatus?.status === "running";
  const { reload } = latest;

  useEffect(() => {
    if (!isInProgress) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [isInProgress, reload]);

  const handleRequest = async () => {
    setIsRequesting(true);
    setRequestError(null);
    try {
      latest.setData(await requestDataExportRequest(requireAccessToken()));
    } catch (error) {
      setRequestError(toApiErrorMessage(error, "Couldn't request your export. Please try again."));
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {exportStatus?.status === "ready" && exportStatus.downloadUrl ? (
        <a href={exportStatus.downloadUrl} className="text-sm font-medium text-primary hover:underline">
          Download export
        </a>
      ) : isInProgress ? (
        <Button size="sm" disabled>
          Export requested
        </Button>
      ) : (
        <Button size="sm" onClick={handleRequest} disabled={isRequesting || latest.isLoading}>
          {isRequesting ? "Requesting…" : "Request export"}
        </Button>
      )}
      {isInProgress && <span className="text-xs text-mutedGray">We&apos;re preparing it — the link appears here.</span>}
      {exportStatus?.status === "failed" && <span className="text-xs text-danger">The last export failed.</span>}
      {requestError && <span className="text-xs text-danger">{requestError}</span>}
    </div>
  );
};
