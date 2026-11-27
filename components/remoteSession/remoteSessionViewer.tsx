"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { SendToTablet } from "@/components/machines/machineApp/sendToTablet";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { usePermissions } from "@/lib/auth/usePermissions";
import { shouldSendKey, toKeyMessage, toScreenPoint, type ControlMessage } from "@/lib/remoteSession/controlInput";
import { useRemoteSession } from "@/lib/remoteSession/useRemoteSession";
import { formatRemoteDuration, remoteEndReasonLabel, type RemoteSession } from "@/lib/types/remoteSession";

interface RemoteSessionViewerProps {
  machineId: string;
  machineLabel: string;
  // Already running (opened with the tablet's password).
  startedSession?: RemoteSession;
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

const EndedSummary = ({ session, hasRecorded }: { session: RemoteSession | null; hasRecorded: boolean }) => {
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
            : !hasRecorded && session.recording.status !== "recording"
              ? "This session wasn't recorded."
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
// scroll sent to it, a microphone, the recording indicator, files to send
// and End.
export const RemoteSessionViewer = ({ machineId, machineLabel, startedSession }: RemoteSessionViewerProps) => {
  const video = useRef<HTMLVideoElement>(null);
  const remote = useRemoteSession(machineId, video, startedSession);
  const { phase, session, stream, sendControl } = remote;
  const viewer = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const pressedPointer = useRef<{ id: number; button: number; x: number; y: number } | null>(null);
  const pressedKeys = useRef(new Map<string, Extract<ControlMessage, { type: "key" }>>());
  const lastHover = useRef(0);
  const [isEnding, setIsEnding] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [clipboardError, setClipboardError] = useState("");
  const live = phase === "live" || phase === "connecting";
  const { can, isLoaded } = usePermissions();
  const canSendFiles = live && isLoaded && can(PERMISSIONS.sendMachineControlFiles);
  const [showFiles, setShowFiles] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
  const canControl = phase === "live" && !playbackBlocked && Boolean(session?.scope.control) &&
    remote.connectionState === "connected" && remote.controlReady;
  const elapsed = useElapsed(session?.startedAt ?? null, phase === "live" || phase === "connecting");

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let current = true;
    element.srcObject = stream;
    setPlaybackBlocked(false);
    if (stream) {
      void element.play().catch(() => {
        if (current) setPlaybackBlocked(true);
      });
    }
    return () => { current = false; };
  }, [live, stream]);

  const playMedia = async () => {
    void remote.resumeRecordingAudio();
    try {
      await video.current?.play();
      setPlaybackBlocked(false);
    } catch {
      setPlaybackBlocked(true);
    }
  };

  const releaseInput = useCallback(() => {
    const pointer = pressedPointer.current;
    if (pointer) {
      const { x, y, button } = pointer;
      sendControl({ v: 1, type: "pointer", action: "cancel", x, y, button });
      pressedPointer.current = null;
    }
    pressedKeys.current.forEach((key) => {
      sendControl({ ...key, action: "up", alt: false, ctrl: false, shift: false, meta: false });
    });
    pressedKeys.current.clear();
  }, [sendControl]);

  useEffect(() => {
    if (!canControl) releaseInput();
    window.addEventListener("blur", releaseInput);
    return () => window.removeEventListener("blur", releaseInput);
  }, [canControl, releaseInput]);

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

  const pointFor = (clientX: number, clientY: number, clampToScreen = false) => {
    const element = video.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return toScreenPoint(clientX, clientY, rect, element.videoWidth, element.videoHeight, clampToScreen);
  };

  const onPointer = (action: "down" | "move" | "up" | "cancel") => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canControl) return;
    const held = pressedPointer.current;
    if (held && held.id !== event.pointerId) return;
    if (!held && (action === "up" || action === "cancel")) return;
    if (action === "move" && !held) {
      const now = performance.now();
      if (now - lastHover.current < HOVER_INTERVAL_MS) return;
      lastHover.current = now;
    }
    const point = action === "cancel" ? held : pointFor(event.clientX, event.clientY, Boolean(held));
    if (!point) {
      if (held && (action === "up" || action === "cancel")) releaseInput();
      return;
    }
    const button = held?.button ?? Math.max(0, event.button);
    if (action === "down") {
      if (held || button > 2) return;
      surface.current?.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      pressedPointer.current = { ...point, id: event.pointerId, button };
      void remote.resumeRecordingAudio();
    } else if (held && action === "move") {
      pressedPointer.current = { ...held, ...point };
    } else if (action === "up" || action === "cancel") {
      pressedPointer.current = null;
    }
    event.preventDefault();
    sendControl({ v: 1, type: "pointer", action, x: point.x, y: point.y, button });
  };

  const paste = async () => {
    setClipboardError("");
    try {
      const text = await navigator.clipboard.readText();
      if (text) sendControl({ v: 1, type: "text", text });
    } catch {
      setClipboardError("Allow clipboard access in your browser to paste to the tablet.");
    }
  };

  const end = async () => {
    releaseInput();
    setIsEnding(true);
    await remote.end();
    setIsEnding(false);
  };

  return (
    <div
      ref={viewer}
      className="flex h-screen flex-col bg-[#0f1115] text-white"
      // A file dropped anywhere is offered to the tablet. Always handled, or
      // the browser would open the file and leave the session.
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        if (!canSendFiles) return;
        setDroppedFiles(Array.from(event.dataTransfer.files));
        setShowFiles(true);
      }}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <Icon name="broadcast" className="h-5 w-5 text-white/70" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-medium">Remote session · {machineLabel || "Machine"}</span>
          <span className="text-xs text-white/60">
            {phase === "requesting" && "Asking the tablet…"}
            {phase === "waiting" && "Waiting for the operator to allow"}
            {phase === "connecting" && "Connecting to the tablet…"}
            {phase === "live" && (
              remote.connectionState === "disconnected" ? "Reconnecting…" :
                remote.videoPaused ? "Live · the tablet isn't sharing its screen" :
                canControl ? "Live · you can tap, type and scroll" :
                  session?.scope.control ? "Live · tablet control unavailable" : "Live · view only"
            )}
            {phase === "ended" && "Ended"}
            {phase === "error" && "Couldn't start"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {live && remote.canRecord && (remote.isRecording || remote.recordingWaitsForScreen) && (
            <>
              {remote.isRecording ? (
                <span className="flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-1 text-xs font-medium text-red-300" role="status">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  Recording
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70" role="status">
                  Recording waits for the tablet&apos;s screen
                </span>
              )}
              <Button
                size="sm"
                variant="danger"
                onClick={remote.stopRecording}
                title="Pause the recording. Resume carries on in the same recording, saved when the session ends."
              >
                <span className="flex gap-0.5" aria-hidden>
                  <span className="h-3 w-1 rounded-sm bg-current" />
                  <span className="h-3 w-1 rounded-sm bg-current" />
                </span>
                Pause recording
              </Button>
            </>
          )}
          {live && remote.canRecord && !remote.isRecording && !remote.recordingWaitsForScreen && (
            <>
              {remote.hasRecorded && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70" role="status">
                  Recording paused
                </span>
              )}
              <Button
                size="sm"
                variant="primary"
                onClick={remote.startRecording}
                title={
                  remote.videoPaused
                    ? "Starts as soon as the tablet shares its screen."
                    : remote.hasRecorded
                      ? "Carry on recording in the same file."
                      : "Record this session to the machine's History. Nothing is recorded before you click."
                }
              >
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
                {remote.hasRecorded ? "Resume recording" : "Start recording"}
              </Button>
            </>
          )}
          {live && elapsed !== null && <span className="tabular-nums text-sm text-white/70">{formatClock(elapsed)}</span>}
          {live && (
            <Button
              size="sm"
              variant="ghost"
              className="!text-white hover:!bg-white/10"
              onClick={() => {
                void playMedia();
                void remote.toggleMic();
              }}
              disabled={phase !== "live" || remote.micPending}
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
              onClick={() => void viewer.current?.requestFullscreen?.()}
              title="Full screen"
            >
              <Icon name="ext" />
            </Button>
          )}
          {canSendFiles && (
            <Button
              size="sm"
              variant="ghost"
              className="!text-white hover:!bg-white/10"
              onClick={() => setShowFiles((open) => !open)}
              aria-expanded={showFiles}
            >
              <Icon name="upload" />
              Send to tablet
            </Button>
          )}
          {canControl && (
            <Button size="sm" variant="ghost" className="!text-white hover:!bg-white/10" onClick={() => void paste()}>
              Paste to tablet
            </Button>
          )}
          {live && (
            <Button
              size="sm"
              variant="ghost"
              className="!text-white hover:!bg-white/10"
              onClick={remote.reconnect}
              title="Connect to the tablet's screen again"
            >
              <Icon name="history" />
              Reconnect
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
          {remote.error && live && (
            <button type="button" className="ml-auto text-xs font-medium underline" onClick={remote.reconnect}>
              Reconnect
            </button>
          )}
          {remote.error && (
            <button type="button" className={`${live ? "" : "ml-auto "}text-xs underline`} onClick={remote.clearError}>
              Dismiss
            </button>
          )}
        </div>
      )}

      {live && remote.recordingNeedsClick && (
        <div className="flex flex-wrap items-center gap-3 bg-red-600/15 px-4 py-2 text-sm text-red-100" role="status">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span>Click anywhere in this window to start the recording. Browsers need a click before they record sound.</span>
          <Button size="sm" variant="primary" className="ml-auto" onClick={() => void playMedia()}>
            Start recording
          </Button>
        </div>
      )}
      {clipboardError && <div role="alert" className="px-4 py-2 text-sm text-amber-200">{clipboardError}</div>}

      <main className="relative flex min-h-0 flex-1 items-center justify-center">
        {live && (
          <div
            ref={surface}
            tabIndex={0}
            role="application"
            aria-label="Tablet screen"
            className={`relative flex h-full w-full items-center justify-center bg-black outline-none ${canControl ? "cursor-default" : ""}`}
            style={{ touchAction: "none" }}
            onPointerDown={onPointer("down")}
            onPointerMove={onPointer("move")}
            onPointerUp={onPointer("up")}
            onPointerCancel={onPointer("cancel")}
            onLostPointerCapture={(event) => {
              if (pressedPointer.current?.id === event.pointerId) releaseInput();
            }}
            onClick={() => void remote.resumeRecordingAudio()}
            onBlur={releaseInput}
            onContextMenu={(event) => canControl && event.preventDefault()}
            onKeyDown={(event) => {
              if (!canControl || !shouldSendKey(event.nativeEvent)) return;
              event.preventDefault();
              const message = toKeyMessage("down", event.nativeEvent);
              pressedKeys.current.set(message.code, message);
              sendControl(message);
            }}
            onKeyUp={(event) => {
              if (!canControl || !pressedKeys.current.delete(event.code)) return;
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
            {remote.isRecording && (
              <>
                <div aria-hidden className="pointer-events-none absolute inset-0 animate-pulse border-4 border-red-600" />
                <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold tracking-wide text-white shadow">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  REC
                </span>
              </>
            )}
            {phase === "live" && playbackBlocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Button variant="primary" onClick={() => void playMedia()}>Play tablet audio and video</Button>
              </div>
            )}
            {phase === "connecting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-sm text-white/80">
                <LoadingSpinner size="md" />
                {remote.connectionState === "disconnected" ? "Reconnecting…" : "Connecting to the tablet…"}
                {remote.connectionState !== "disconnected" && (
                  <span className="text-xs text-white/60">
                    {session?.access === "unattended" ? "Waiting for the tablet's screen." : "On the tablet, choose the screen to share."}
                  </span>
                )}
                <span className="max-w-xs text-center text-xs text-white/50">
                  Already sharing on the tablet, or it shared again? Reconnect to pick up its screen.
                </span>
                <Button size="sm" onClick={remote.reconnect}>
                  <Icon name="history" className="h-3.5 w-3.5" />
                  Reconnect
                </Button>
              </div>
            )}
            {phase === "live" && !playbackBlocked && (remote.connectionState === "disconnected" || remote.videoPaused) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-sm text-white/80">
                {remote.connectionState === "disconnected" ? <LoadingSpinner size="md" /> : <Icon name="alert" className="h-6 w-6 text-amber-300" />}
                {remote.connectionState === "disconnected"
                  ? "Connection to the tablet dropped. Reconnecting…"
                  : "The tablet stopped sharing its screen."}
                <span className="max-w-xs text-center text-xs text-white/60">
                  When the tablet shares its screen again, select Reconnect.
                </span>
                <Button size="sm" onClick={remote.reconnect}>
                  <Icon name="history" className="h-3.5 w-3.5" />
                  Reconnect
                </Button>
              </div>
            )}
          </div>
        )}

        {canSendFiles && (
          // Stays mounted when closed, so chosen files and a running send survive.
          <aside
            aria-label="Send to tablet"
            className={`absolute right-0 top-0 z-10 max-h-full w-80 max-w-full flex-col gap-3 overflow-y-auto rounded-bl-xl bg-surface p-4 text-ink shadow-xl ${showFiles ? "flex" : "hidden"}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium">Send to tablet</h2>
              <button type="button" aria-label="Close" onClick={() => setShowFiles(false)} className="rounded-md p-1 text-bodyGray hover:bg-fillGray">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <SendToTablet machineId={machineId} incoming={droppedFiles} />
          </aside>
        )}

        {(phase === "requesting" || phase === "waiting") && (
          <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
            <LoadingSpinner size="md" />
            <h2 className="text-lg font-medium">Waiting for the operator</h2>
            <p className="text-sm text-white/70">
              The tablet on {machineLabel || "this machine"} is asking its operator to allow remote support. Once
              connected, Start recording saves the session to History. You can talk with the operator and control the tablet if they allow it.
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
            <EndedSummary session={session} hasRecorded={remote.hasRecorded} />
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
