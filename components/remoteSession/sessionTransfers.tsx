"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons/icon";
import { DocumentViewer, type ViewableDocument } from "@/components/machines/documentViewer/documentViewer";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Tag } from "@/components/ui/tag";
import type { Tone } from "@/components/ui/tone";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getDesignDownload, listDesigns, type Delivery, type DesignStatus, type DesignVersion } from "@/lib/api/machineDesignApi";
import { listMachineDocumentsRequest } from "@/lib/api/machineDocumentsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { usePermissions } from "@/lib/auth/usePermissions";
import { formatFileSize } from "@/lib/format/fileSize";
import type { MachineDocument } from "@/lib/types/machineDocument";
import type { RemoteSessionSummary } from "@/lib/types/remoteSession";

// A file sent after the session ended still counts for a short while (the
// operator often sends a photo or report right after).
const AFTER_SESSION_GRACE_MS = 2 * 60 * 1000;

export type SessionTransfer =
  | { kind: "received"; id: string; at: string; document: MachineDocument }
  | { kind: "sent"; id: string; at: string; delivery: Delivery; version: DesignVersion | null };

interface TransfersState {
  transfers: SessionTransfer[];
  error: string | null;
  isLoading: boolean;
}

const TransfersContext = createContext<TransfersState | null>(null);

// Loads the machine's tablet transfers once for the whole History list:
// files the tablet sent (Documents with fromTablet) and designs sent to it.
// Nothing loads until `enabled` (a remote session is on screen).
export const SessionTransfersProvider = ({ machineId, enabled, children }: { machineId: string; enabled: boolean; children: ReactNode }) => {
  const { can, isLoaded } = usePermissions();
  const canSeeSent = isLoaded && can(PERMISSIONS.viewMachineControl);
  const [state, setState] = useState<TransfersState>({ transfers: [], error: null, isLoading: false });

  useEffect(() => {
    if (!enabled || !isLoaded) return;
    let current = true;
    setState((previous) => ({ ...previous, isLoading: true }));
    const load = async () => {
      const token = requireAccessToken();
      const [documents, designs] = await Promise.allSettled([
        listMachineDocumentsRequest(token, machineId),
        canSeeSent ? listDesigns(token) : Promise.resolve(null),
      ]);
      const transfers: SessionTransfer[] = [];
      const problems: string[] = [];
      if (documents.status === "fulfilled") {
        for (const document of documents.value) {
          if (document.fromTablet) transfers.push({ kind: "received", id: `received-${document.id}`, at: document.uploadedAt, document });
        }
      } else {
        problems.push(toApiErrorMessage(documents.reason, "Couldn't load files from the tablet."));
      }
      if (designs.status === "fulfilled" && designs.value) {
        const versions = new Map(designs.value.versions.map((version) => [version.id, version]));
        for (const delivery of designs.value.deliveries) {
          if (delivery.machineId !== machineId) continue;
          transfers.push({ kind: "sent", id: `sent-${delivery.id}`, at: delivery.createdAt, delivery, version: versions.get(delivery.versionId) ?? null });
        }
      } else if (designs.status === "rejected") {
        problems.push(toApiErrorMessage(designs.reason, "Couldn't load files sent to the tablet."));
      }
      transfers.sort((a, b) => a.at.localeCompare(b.at));
      if (current) setState({ transfers, error: problems.join(" ") || null, isLoading: false });
    };
    load().catch((error: unknown) => {
      if (current) setState({ transfers: [], error: toApiErrorMessage(error, "Couldn't load session files."), isLoading: false });
    });
    return () => {
      current = false;
    };
  }, [machineId, enabled, isLoaded, canSeeSent]);

  return <TransfersContext.Provider value={state}>{children}</TransfersContext.Provider>;
};

// The transfers between a session's start and shortly after its end.
export const transfersDuring = (transfers: SessionTransfer[], session: Pick<RemoteSessionSummary, "startedAt" | "endedAt">, now = Date.now()) => {
  if (!session.startedAt) return [];
  const from = new Date(session.startedAt).getTime();
  const to = (session.endedAt ? new Date(session.endedAt).getTime() : now) + AFTER_SESSION_GRACE_MS;
  return transfers.filter((transfer) => {
    const at = new Date(transfer.at).getTime();
    return at >= from && at <= to;
  });
};

const DELIVERY_STATUS: Record<DesignStatus, { label: string; tone: Tone }> = {
  waiting: { label: "Waiting for tablet", tone: "default" },
  downloading: { label: "Downloading", tone: "amber" },
  arrived: { label: "Delivered", tone: "ok" },
  failed: { label: "Failed", tone: "danger" },
};

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

// "Files during this session" on a remote session's History entry. Renders
// nothing outside a SessionTransfersProvider or when there are no files.
export const SessionTransferList = ({ session }: { session: RemoteSessionSummary }) => {
  const state = useContext(TransfersContext);
  const [viewing, setViewing] = useState<ViewableDocument | null>(null);
  const files = useMemo(() => (state ? transfersDuring(state.transfers, session) : []), [state, session]);
  if (!state) return null;
  if (state.isLoading && files.length === 0) {
    return (
      <span className="flex items-center gap-2 text-xs text-mutedGray">
        <LoadingSpinner size="sm" />
        Loading session files…
      </span>
    );
  }
  if (files.length === 0) return state.error ? <span className="text-xs text-mutedGray">{state.error}</span> : null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-bodyGray">Files during this session · {files.length}</span>
      <ul className="flex flex-col divide-y divide-borderGray overflow-hidden rounded-lg border border-borderGray">
        {files.map((transfer) =>
          transfer.kind === "received" ? (
            <li key={transfer.id} className="flex flex-wrap items-center gap-2 bg-surface px-3 py-2">
              <Icon name="download" className="h-3.5 w-3.5 flex-none text-mutedGray" />
              <button
                type="button"
                onClick={() =>
                  setViewing({
                    fileName: transfer.document.fileName,
                    contentType: transfer.document.contentType,
                    url: transfer.document.signedUrl,
                    downloadUrl: transfer.document.downloadUrl,
                  })
                }
                className="min-w-0 flex-1 truncate text-left text-sm text-ink hover:underline"
                title={transfer.document.fileName}
              >
                {transfer.document.fileName}
              </button>
              <span className="text-xs text-mutedGray">
                From tablet · {timeFormat.format(new Date(transfer.at))} · {formatFileSize(transfer.document.sizeBytes)}
              </span>
              <a href={transfer.document.downloadUrl} aria-label={`Download ${transfer.document.fileName}`} className="rounded-md p-1 text-bodyGray hover:bg-fillGray">
                <Icon name="download" className="h-3.5 w-3.5" />
              </a>
            </li>
          ) : (
            <SentDelivery key={transfer.id} delivery={transfer.delivery} version={transfer.version} at={transfer.at} />
          ),
        )}
      </ul>
      {state.error && <span className="text-xs text-mutedGray">{state.error}</span>}
      {viewing && <DocumentViewer document={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

const SentDelivery = ({ delivery, version, at }: { delivery: Delivery; version: DesignVersion | null; at: string }) => {
  const status = DELIVERY_STATUS[delivery.status];
  const files = version?.files ?? [];
  return (
    <li className="flex flex-col gap-1.5 bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="upload" className="h-3.5 w-3.5 flex-none text-mutedGray" />
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{delivery.project}</span>
        <span className="text-xs text-mutedGray">To tablet · {timeFormat.format(new Date(at))}</span>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>
      {delivery.error && <span className="pl-5 text-xs text-danger">{delivery.error}</span>}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1 pl-5">
          {files.map((file, index) => (
            <SentFile key={file.path} versionId={delivery.versionId} index={index} path={file.path} sizeBytes={file.sizeBytes} />
          ))}
        </ul>
      )}
    </li>
  );
};

const SentFile = ({ versionId, index, path, sizeBytes }: { versionId: string; index: number; path: string; sizeBytes: number }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await getDesignDownload(requireAccessToken(), versionId, index);
      window.open(url, "_blank", "noopener");
    } catch (downloadError) {
      setError(toApiErrorMessage(downloadError, "Couldn't download this file."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex flex-wrap items-center gap-2 text-xs">
      <Icon name="file" className="h-3.5 w-3.5 flex-none text-mutedGray" />
      <span className="min-w-0 flex-1 truncate text-ink" title={path}>
        {path}
      </span>
      <span className="tabular-nums text-mutedGray">{formatFileSize(sizeBytes)}</span>
      <button type="button" onClick={() => void download()} disabled={busy} aria-label={`Download ${path}`} className="rounded-md p-1 text-bodyGray hover:bg-fillGray disabled:opacity-50">
        {busy ? <LoadingSpinner size="sm" /> : <Icon name="download" className="h-3.5 w-3.5" />}
      </button>
      {error && <span className="w-full text-danger">{error}</span>}
    </li>
  );
};
