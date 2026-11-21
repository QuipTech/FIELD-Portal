"use client";

import { Fragment, useMemo, useState } from "react";
import { PermissionButton } from "@/components/auth/permissionButton";
import { Icon } from "@/components/icons/icon";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import {
  deleteRemoteRecordingRequest,
  deleteRemoteSessionRequest,
  getRecordingUrlRequest,
  getTranscriptRequest,
} from "@/lib/api/remoteSessionApi";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { usePermissions } from "@/lib/auth/usePermissions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { formatRemoteDuration, remoteEndReasonLabel, type RemoteSessionSummary } from "@/lib/types/remoteSession";
import { SessionTransferList } from "./sessionTransfers";

interface RemoteSessionHistoryDetailsProps {
  machineId: string;
  session: RemoteSessionSummary;
  // After an admin deleted the whole session, so the entry can disappear.
  onSessionDeleted?: () => void;
}

// Highlights every match of `query` in `text`.
const highlight = (text: string, query: string) => {
  const needle = query.trim();
  if (!needle) return text;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${escaped})`, "gi")).map((piece, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded bg-amberTint px-0.5 text-ink">
        {piece}
      </mark>
    ) : (
      <Fragment key={index}>{piece}</Fragment>
    ),
  );
};

// A remote session on the machine's History: who, how long, why it ended,
// its recording and transcript (with remote support permission), and the
// files sent to or from the tablet during it.
export const RemoteSessionHistoryDetails = ({ machineId, session: initialSession, onSessionDeleted }: RemoteSessionHistoryDetailsProps) => {
  const [session, setSession] = useState(initialSession);
  const [confirming, setConfirming] = useState<"recording" | "session" | null>(null);
  const { can } = usePermissions();
  const canDelete = can(PERMISSIONS.deleteMachineControlRemote);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState<"recording" | "transcript" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !transcript) return 0;
    return transcript.toLowerCase().split(needle).length - 1;
  }, [query, transcript]);

  const playRecording = async () => {
    setLoading("recording");
    setError(null);
    try {
      setRecordingUrl((await getRecordingUrlRequest(machineId, session.id)).url);
    } catch (loadError) {
      setError(toApiErrorMessage(loadError, "Couldn't load the recording."));
    } finally {
      setLoading(null);
    }
  };

  const showTranscript = async () => {
    if (transcript !== null) {
      setTranscript(null);
      return;
    }
    setLoading("transcript");
    setError(null);
    try {
      const result = await getTranscriptRequest(machineId, session.id);
      setTranscript(result.text?.trim() || "No speech was transcribed in this session.");
    } catch (loadError) {
      setError(toApiErrorMessage(loadError, "Couldn't load the transcript."));
    } finally {
      setLoading(null);
    }
  };

  const recordingNote =
    session.recordingStatus === "failed" || session.recordingStatus === "none"
      ? "No recording"
      : session.recordingStatus !== "completed"
        ? "Recording is being saved"
        : null;
  const transcriptNote =
    session.transcriptStatus === "processing"
      ? "Transcript in progress"
      : session.transcriptStatus === "failed"
        ? "Transcript unavailable"
        : null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-bodyGray">
        {[session.requesterName, formatRemoteDuration(session.durationSeconds), remoteEndReasonLabel(session.endReason)]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {session.recordingStatus === "completed" && !recordingUrl && (
          <PermissionButton permission={PERMISSIONS.useMachineControlRemote} size="sm" onClick={() => void playRecording()} disabled={loading !== null}>
            {loading === "recording" ? <LoadingSpinner size="sm" /> : <Icon name="play" className="h-3.5 w-3.5" />}
            Play recording
          </PermissionButton>
        )}
        {session.transcriptStatus === "completed" && (
          <PermissionButton permission={PERMISSIONS.useMachineControlRemote} size="sm" onClick={() => void showTranscript()} disabled={loading !== null}>
            {loading === "transcript" ? <LoadingSpinner size="sm" /> : <Icon name="file" className="h-3.5 w-3.5" />}
            {transcript === null ? "Transcript" : "Hide transcript"}
          </PermissionButton>
        )}
        {recordingNote && <span className="text-xs text-mutedGray">{recordingNote}</span>}
        {canDelete && (
          <span className="ml-auto flex items-center gap-1">
            {(session.recordingStatus === "completed" || session.recordingStatus === "failed") && (
              <Button size="sm" variant="ghost" onClick={() => setConfirming("recording")}>
                <Icon name="x" className="h-3.5 w-3.5" />
                Delete recording
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => setConfirming("session")}>
              Delete session
            </Button>
          </span>
        )}
        {transcriptNote && <span className="text-xs text-mutedGray">{transcriptNote}</span>}
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <SessionTransferList session={session} />
      {confirming === "recording" && (
        <ConfirmDialog
          title="Delete recording"
          confirmLabel="Delete recording"
          onConfirm={async () => {
            await deleteRemoteRecordingRequest(machineId, session.id);
            setRecordingUrl(null);
            setTranscript(null);
            setSession({ ...session, recordingStatus: "none", transcriptStatus: "none" });
          }}
          onClose={() => setConfirming(null)}
          toErrorMessage={(deleteError) => toApiErrorMessage(deleteError, "Couldn't delete the recording. Please try again.")}
        >
          The video and transcript of this session are deleted for good. The session stays in History.
        </ConfirmDialog>
      )}
      {confirming === "session" && (
        <ConfirmDialog
          title="Delete remote session"
          confirmLabel="Delete session"
          onConfirm={async () => {
            await deleteRemoteSessionRequest(machineId, session.id);
            onSessionDeleted?.();
          }}
          onClose={() => setConfirming(null)}
          toErrorMessage={(deleteError) => toApiErrorMessage(deleteError, "Couldn't delete the session. Please try again.")}
        >
          The session is removed from this machine&apos;s History, and its video and transcript are deleted for good.
        </ConfirmDialog>
      )}
      {recordingUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- the transcript is shown alongside
        <video src={recordingUrl} controls autoPlay className="max-h-[420px] w-full rounded-lg bg-black" />
      )}
      {transcript !== null && (
        <div className="flex flex-col gap-2 rounded-lg border border-borderGray bg-surfaceGray p-3">
          <label className="flex items-center gap-2 text-xs text-bodyGray">
            <Icon name="search" className="h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the transcript"
              className="h-8 flex-1 rounded-md border border-borderGrayStrong bg-surface px-2 text-sm text-ink"
            />
            {query.trim() && <span className="tabular-nums">{matches} found</span>}
          </label>
          <p className="max-h-64 overflow-y-auto whitespace-pre-line text-sm text-ink">{highlight(transcript, query)}</p>
        </div>
      )}
    </div>
  );
};
