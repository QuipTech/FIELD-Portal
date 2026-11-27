"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { listTabletFileSendsRequest, sendTabletFilesRequest } from "@/lib/api/tabletFilesApi";
import { formatFileSize } from "@/lib/format/fileSize";
import { formatShortDateTime } from "@/lib/format/shortDate";
import { addTabletFiles, tabletFilesProblem, type TabletFileSend } from "@/lib/types/tabletFiles";
import { FileTransferDetails } from "./fileTransferDetails";

const PENDING_POLL_MS = 3000;
const IDLE_POLL_MS = 15000;
const SHOWN_SENDS = 5;

interface SendToTabletProps {
  machineId: string;
  // Files dropped elsewhere in the window, to add to the chosen ones.
  incoming?: File[] | null;
}

// Choose or drop files, send them to this machine's tablet and follow each
// send. The caller shows it only to people who may send (mc.deliver).
export const SendToTablet = ({ machineId, incoming }: SendToTabletProps) => {
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [sends, setSends] = useState<TabletFileSend[]>([]);
  const [listError, setListError] = useState("");
  const [revision, setRevision] = useState(0);
  // Kept until the chosen files change, so a retry can't send them twice.
  const sendId = useRef<string | null>(null);

  const add = useCallback((files: File[]) => {
    if (!files.length) return;
    sendId.current = null;
    setError("");
    setChosen((previous) => addTabletFiles(previous, files));
  }, []);

  useEffect(() => {
    if (incoming) add(incoming);
  }, [incoming, add]);

  useEffect(() => {
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let delay = IDLE_POLL_MS;
      try {
        const result = await listTabletFileSendsRequest(machineId);
        if (!current) return;
        setSends(result.sends);
        setListError("");
        if (result.sends.some((send) => send.status === "waiting" || send.status === "downloading")) delay = PENDING_POLL_MS;
      } catch (loadError) {
        if (!current) return;
        setListError(toApiErrorMessage(loadError, "Couldn't refresh the send status."));
      }
      timer = setTimeout(poll, delay);
    };
    void poll();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [machineId, revision]);

  const problem = tabletFilesProblem(chosen);

  const send = async () => {
    setError("");
    setIsSending(true);
    sendId.current ??= crypto.randomUUID();
    try {
      await sendTabletFilesRequest(machineId, sendId.current, chosen);
      sendId.current = null;
      setChosen([]);
      setRevision((value) => value + 1);
    } catch (sendError) {
      setError(toApiErrorMessage(sendError, "Couldn't send the files. Check your connection and try again."));
    } finally {
      setIsSending(false);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (!isSending) add(Array.from(event.dataTransfer.files));
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center ${
          isDragging ? "border-primary bg-fillGray" : "border-borderGrayStrong"
        }`}
      >
        <Icon name="upload" className="h-5 w-5 text-mutedGray" />
        <span className="text-sm text-bodyGray">Drop files here</span>
        <Button size="sm" onClick={() => input.current?.click()} disabled={isSending}>
          Browse files
        </Button>
        <span className="text-xs text-mutedGray">Any file type · up to 32 files · 5 MB each · 20 MB per send</span>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          aria-label="Files to send to the tablet"
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>

      {chosen.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1">
            {chosen.map((file) => (
              <li key={file.name} className="flex items-center gap-2 text-sm">
                <Icon name="file" className="h-3.5 w-3.5 flex-none text-mutedGray" />
                <span className="min-w-0 flex-1 truncate text-ink" title={file.name}>
                  {file.name}
                </span>
                <span className="text-xs tabular-nums text-mutedGray">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  disabled={isSending}
                  onClick={() => {
                    sendId.current = null;
                    setError("");
                    setChosen((previous) => previous.filter((other) => other !== file));
                  }}
                  className="rounded-md p-1 text-bodyGray hover:bg-fillGray disabled:opacity-50"
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="primary" size="sm" className="self-start" onClick={() => void send()} disabled={isSending || Boolean(problem)}>
            {isSending ? <LoadingSpinner size="sm" /> : <Icon name="upload" className="h-3.5 w-3.5" />}
            {isSending ? "Sending…" : "Send to tablet"}
          </Button>
        </div>
      )}
      {(problem || error) && (
        <span role="alert" className="text-xs text-danger">
          {problem || error}
        </span>
      )}

      {sends.length > 0 && (
        <ul className="flex flex-col divide-y divide-borderGray rounded-lg border border-borderGray" aria-live="polite">
          {sends.slice(0, SHOWN_SENDS).map((item) => (
            <li key={item.id} className="px-3 py-2">
              <FileTransferDetails
                transfer={item}
                caption={`${formatShortDateTime(item.createdAt)}${item.senderName ? ` · ${item.senderName}` : ""}`}
              />
            </li>
          ))}
        </ul>
      )}
      {listError && <span role="status" className="text-xs text-mutedGray">{listError}</span>}
    </div>
  );
};
