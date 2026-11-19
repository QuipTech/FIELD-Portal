"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { shouldSendKey, toKeyMessage, toScreenPoint } from "@/lib/remoteSession/controlInput";
import { useRemoteSession } from "@/lib/remoteSession/useRemoteSession";
import { formatRemoteDuration, remoteEndReasonLabel, type RemoteSession } from "@/lib/types/remoteSession";

interface RemoteSessionViewerProps {
  machineId: string;
  machineLabel: string;
}

const HOVER_INTERVAL_MS = 33;

// Seconds since the session started, ticking each second.
const useElapsed = (startedAt: string | null, running: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) : null;
};

const formatClock = (seconds: number | null) => {
  if (seconds === null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const EndedSummary = ({ session }: { session: RemoteSession | null }) => {
  if (!session) return null;
  const declined = session.status === "declined";
  return (
    <div className="flex max-w-md flex-col items-center gap-3 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-fillGray text-bodyGray">
        <Icon name={declined ? "x" : "check"} className="h-6 w-6" />
      </span>
      <h2 className="text-lg font-medium text-ink">{declined ? "The operator declined" : "Remote session ended"}</h2>
      <p className="text-sm text-bodyGray">
        {remoteEndReasonLabel(session.endReason)}
        {session.durationSeconds !== null && ` · ${formatRemoteDuration(session.durationSeconds)}`}
      </p>
      {session.startedAt && session.scope.record && (
        <p className="text-sm text-bodyGray">
          {session.recording.status === "completed"
            ? "The recording is saved to the machine's History."
            : session.recording.status === "failed"
              ? `The recording couldn't be saved${session.recording.error ? `: ${session.recording.error}` : "."}`
              : "The recording is being saved to the machine's History."}
        </p>
      )}
      <Button variant="primary" onClick={() => window.close()}>
        Close window
      </Button>
    </div>
  );
};

// The remote session window: the tablet's live screen, with tap, type and
// scroll sent to it, a microphone, the recording indicator and End.
export const RemoteSessionViewer = ({ machineId, machineLabel }: RemoteSessionViewerProps) => {
  const remote = useRemoteSession(machineId);
  const { phase, session, stream, sendControl } = remote;
  const video = useRef<HTMLVideoElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const pointerDown = useRef(false);
  const lastHover = useRef(0);
  const [isEnding, setIsEnding] = useState(false);
  const canControl = Boolean(session?.scope.control) && remote.controlReady;
  const elapsed = useElapsed(session?.startedAt ?? null, phase === "live" || phase === "connecting");

  useEffect(() => {
    if (video.current && stream && video.current.srcObject !== stream) video.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    document.title = `Remote session · ${machineLabel || "Machine"}`;
  }, [machineLabel]);

  // Wheel needs a non-passive listener to keep the window from scrolling.
  useEffect(() => {
    const element = surface.current;
    if (!element || !canControl) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = pointFor(event.clientX, event.clientY);
      if (point) sendControl({ v: 1, type: "wheel", ...point, deltaX: event.deltaX, deltaY: event.deltaY });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  });

  const pointFor = (clientX: number, clientY: number) => {
    const element = video.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return toScreenPoint(clientX, clientY, rect, element.videoWidth, element.videoHeight);
  };

  const onPointer = (action: "down" | "move" | "up" | "cancel") => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canControl) return;
    if (action === "move" && !pointerDown.current) {
      const now = performance.now();
      if (now - lastHover.current < HOVER_INTERVAL_MS) return;
      lastHover.current = now;
    }
    const point = pointFor(event.clientX, event.clientY);
    if (action === "down") {
      surface.current?.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerDown.current = true;
    }
    if (action === "up" || action === "cancel") pointerDown.current = false;
    if (!point) return;
    event.preventDefault();
    sendControl({ v: 1, type: "pointer", action, ...point, button: event.button < 0 ? 0 : event.button });
  };

  const end = async () => {
    setIsEnding(true);
    await remote.end();
    setIsEnding(false);
  };

  const live = phase === "live" || phase === "connecting";

  return (
    <div className="flex h-screen flex-col bg-[#0f1115] text-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <Icon name="broadcast" className="h-5 w-5 text-white/70" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-medium">Remote session · {machineLabel || "Machine"}</span>
          <span className="text-xs text-white/60">
            {phase === "requesting" && "Asking the tablet…"}
            {phase === "waiting" && "Waiting for the operator to allow"}
            {phase === "connecting" && "Connecting to the tablet…"}
            {phase === "live" && (canControl ? "Live · you can tap, type and scroll" : "Live · view only")}
            {phase === "ended" && "Ended"}
            {phase === "error" && "Couldn't start"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {live && remote.isRecording && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-1 text-xs font-medium text-red-300" role="status">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Recording
            </span>
          )}
          {live && elapsed !== null && <span className="tabular-nums text-sm text-white/70">{formatClock(elapsed)}</span>}
          {live && (
            <Button
              size="sm"
              variant="ghost"
              className="!text-white hover:!bg-white/10"
              onClick={() => void remote.toggleMic()}
              aria-pressed={remote.micOn}
              title={remote.micOn ? "Turn microphone off" : "Turn microphone on"}
            >
              <Icon name="mic" className={remote.micOn ? "text-emerald-400" : "text-white/60"} />
              {remote.micOn ? "Mic on" : "Mic off"}
            </Button>
          )}
          {live && (
            <Button
              size="sm"
              variant="ghost"
              className="!text-white hover:!bg-white/10"
              onClick={() => void surface.current?.requestFullscreen?.()}
              title="Full screen"
            >
              <Icon name="ext" />
            </Button>
          )}
          {(phase === "waiting" || live) && (
            <Button size="sm" variant="danger" onClick={() => void end()} disabled={isEnding}>
              {isEnding ? "Ending…" : phase === "waiting" ? "Cancel" : "End session"}
            </Button>
          )}
        </div>
      </header>

      {(remote.error || remote.recordingError) && phase !== "error" && (
        <div className="flex items-center gap-2 bg-amber-500/15 px-4 py-2 text-sm text-amber-200" role="alert">
          <Icon name="alert" className="h-4 w-4" />
          <span>{remote.error ?? remote.recordingError}</span>
          {remote.error && (
            <button type="button" className="ml-auto text-xs underline" onClick={remote.clearError}>
              Dismiss
            </button>
          )}
        </div>
      )}

      <main className="relative flex min-h-0 flex-1 items-center justify-center">
        {live && (
          <div
            ref={surface}
            tabIndex={0}
            role="application"
            aria-label="Tablet screen"
            className={`relative flex h-full w-full items-center justify-center bg-black outline-none ${canControl ? "cursor-crosshair" : ""}`}
            style={{ touchAction: "none" }}
            onPointerDown={onPointer("down")}
            onPointerMove={onPointer("move")}
            onPointerUp={onPointer("up")}
            onPointerCancel={onPointer("cancel")}
            onContextMenu={(event) => canControl && event.preventDefault()}
            onKeyDown={(event) => {
              if (!canControl || !shouldSendKey(event.nativeEvent)) return;
              event.preventDefault();
              sendControl(toKeyMessage("down", event.nativeEvent));
            }}
            onKeyUp={(event) => {
              if (!canControl || !shouldSendKey(event.nativeEvent)) return;
              event.preventDefault();
              sendControl(toKeyMessage("up", event.nativeEvent));
            }}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              if (!canControl || !text) return;
              event.preventDefault();
              sendControl({ v: 1, type: "text", text });
            }}
          >
            <video ref={video} autoPlay playsInline className="h-full w-full object-contain" />
            {phase === "connecting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-sm text-white/80">
                <LoadingSpinner size="md" />
                {remote.connectionState === "disconnected" ? "Reconnecting…" : "Connecting to the tablet…"}
              </div>
            )}
          </div>
        )}

        {(phase === "requesting" || phase === "waiting") && (
          <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
            <LoadingSpinner size="md" />
            <h2 className="text-lg font-medium">Waiting for the operator</h2>
            <p className="text-sm text-white/70">
              The tablet on {machineLabel || "this machine"} is asking its operator to allow remote support. The session
              is recorded.
            </p>
            {session && <ExpiryCountdown expiresAt={session.expiresAt} />}
          </div>
        )}

        {phase === "error" && (
          <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <Icon name="alert" className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-medium">Couldn&apos;t start a remote session</h2>
            <p className="text-sm text-white/70">{remote.error}</p>
            <Button onClick={() => window.close()}>Close window</Button>
          </div>
        )}

        {phase === "ended" && (
          <div className="rounded-xl bg-surface px-8 py-7">
            <EndedSummary session={session} />
          </div>
        )}
      </main>
    </div>
  );
};

const ExpiryCountdown = ({ expiresAt }: { expiresAt: string }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return <span className="tabular-nums text-xs text-white/50">Request expires in {left} s</span>;
};
