"use client";

import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/icons/icon";
import { RemoteSessionHistoryDetails } from "@/components/remoteSession/remoteSessionHistoryDetails";
import { Button } from "@/components/ui/button";
import { buttonBaseClasses, buttonSizeClasses, buttonVariantClasses } from "@/components/ui/buttonStyles";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/emptyState";
import { IconTile } from "@/components/ui/iconTile";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { Tag } from "@/components/ui/tag";
import type { Tone } from "@/components/ui/tone";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getDesignDownload, type DesignStatus } from "@/lib/api/machineDesignApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { usePermissions } from "@/lib/auth/usePermissions";
import { formatFileSize } from "@/lib/format/fileSize";
import { machineDocumentTypeLabels } from "@/lib/types/machineDocument";
import { formatRemoteDuration, remoteEndReasonLabel, type RemoteSessionSummary } from "@/lib/types/remoteSession";
import { useMachineAppActivity, type ActivityItem, type ActivityKind } from "./useMachineAppActivity";

const PAGE_SIZE = 15;

type Filter = "all" | ActivityKind;

const FILTERS: { value: Filter; label: string; icon: IconName }[] = [
  { value: "all", label: "All", icon: "layers" },
  { value: "session", label: "Remote sessions", icon: "broadcast" },
  { value: "received", label: "Received", icon: "download" },
  { value: "sent", label: "Sent", icon: "upload" },
];

const KIND_STYLE: Record<ActivityKind, { icon: IconName; tone: Tone }> = {
  session: { icon: "broadcast", tone: "primary" },
  received: { icon: "download", tone: "default" },
  sent: { icon: "upload", tone: "amber" },
};

const DELIVERY_STATUS: Record<DesignStatus, { label: string; tone: Tone }> = {
  waiting: { label: "Waiting for tablet", tone: "default" },
  downloading: { label: "Downloading", tone: "amber" },
  arrived: { label: "Delivered", tone: "ok" },
  failed: { label: "Failed", tone: "danger" },
};

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short", year: "numeric" });

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const dayLabel = (iso: string) => {
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return dayFormat.format(new Date(iso));
};

const sessionRecording = (session: RemoteSessionSummary): { label: string; tone: Tone } => {
  if (session.recordingStatus === "completed") return { label: "Recorded", tone: "primary" };
  if (session.recordingStatus === "pending" || session.recordingStatus === "recording") return { label: "Saving recording", tone: "amber" };
  return { label: "No recording", tone: "default" };
};

const totalDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds} s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
};

const searchText = (item: ActivityItem) => {
  if (item.kind === "session") return `${item.session.requesterName} ${remoteEndReasonLabel(item.session.endReason)} remote session`;
  if (item.kind === "received") return `${item.document.fileName} ${machineDocumentTypeLabels[item.document.documentType]}`;
  return `${item.delivery.project} ${(item.version?.files ?? []).map((file) => file.path).join(" ")}`;
};

interface MachineAppActivityProps {
  machineId: string;
}

// The Machine app tab's record of everything between the Portal and the
// tablet: remote sessions with their recordings, and files both ways.
export const MachineAppActivity = ({ machineId }: MachineAppActivityProps) => {
  const { can, isLoaded } = usePermissions();
  const canSeeSentFiles = isLoaded && can(PERMISSIONS.viewMachineControl);
  const activity = useMachineAppActivity(machineId, canSeeSentFiles);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const sessions = activity.items.filter((item) => item.kind === "session");
    return {
      sessions: sessions.length,
      seconds: sessions.reduce((sum, item) => sum + (item.session.durationSeconds ?? 0), 0),
      recordings: sessions.filter((item) => item.session.recordingStatus === "completed").length,
      received: activity.items.filter((item) => item.kind === "received").length,
      sent: activity.items.filter((item) => item.kind === "sent").length,
    };
  }, [activity.items]);

  const counts: Record<Filter, number> = {
    all: activity.items.length,
    session: stats.sessions,
    received: stats.received,
    sent: stats.sent,
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activity.items.filter(
      (item) => (filter === "all" || item.kind === filter) && (!needle || searchText(item).toLowerCase().includes(needle)),
    );
  }, [activity.items, filter, query]);

  const groups = useMemo(() => {
    const result: { label: string; items: ActivityItem[] }[] = [];
    for (const item of visible.slice(0, shown)) {
      const label = dayLabel(item.at);
      const last = result[result.length - 1];
      if (last?.label === label) last.items.push(item);
      else result.push({ label, items: [item] });
    }
    return result;
  }, [visible, shown]);

  return (
    <Card className="gap-4 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[17px] font-semibold text-ink">Sessions and files</h2>
          <p className="text-sm text-bodyGray">Every remote session, its recording, and the files sent to and from this tablet.</p>
        </div>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={activity.reload} disabled={activity.isLoading} aria-label="Refresh activity">
          {activity.isLoading ? <LoadingSpinner size="sm" /> : <Icon name="history" className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Stat icon="broadcast" tone="primary" label="Remote sessions" value={String(stats.sessions)} />
        <Stat icon="clock" tone="default" label="Time connected" value={totalDuration(stats.seconds)} />
        <Stat icon="play" tone="primary" label="Recordings" value={String(stats.recordings)} />
        <Stat icon="file" tone="amber" label="Files" value={`${stats.received} in · ${stats.sent} out`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => {
            const active = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilter(option.value);
                  setShown(PAGE_SIZE);
                }}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-borderGrayStrong bg-surface text-bodyGray hover:bg-surfaceGray"
                }`}
              >
                <Icon name={option.icon} className="h-3.5 w-3.5" />
                {option.label}
                <span className={`tabular-nums ${active ? "text-white/80" : "text-mutedGray"}`}>{counts[option.value]}</span>
              </button>
            );
          })}
        </div>
        <label className="flex h-8 min-w-[180px] flex-1 items-center gap-2 rounded-full border border-borderGrayStrong bg-surface px-3 text-sm sm:max-w-xs md:ml-auto">
          <Icon name="search" className="h-3.5 w-3.5 text-mutedGray" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShown(PAGE_SIZE);
            }}
            placeholder="Search people or files"
            aria-label="Search sessions and files"
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-mutedGray"
          />
        </label>
      </div>

      {activity.problems.length > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amberBorder bg-amberTint px-3 py-2 text-sm text-amber">
          <Icon name="alert" className="mt-0.5 h-4 w-4 flex-none" />
          <span>{activity.problems.join(" ")}</span>
        </div>
      )}

      {activity.isLoading && activity.items.length === 0 ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <SkeletonBar className="h-[34px] w-[34px] rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <SkeletonBar className="h-3.5 w-1/3" />
                <SkeletonBar className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={filter === "all" ? "layers" : KIND_STYLE[filter].icon}
          title={query.trim() ? "Nothing matches your search" : emptyTitle(filter)}
          description={query.trim() ? "Try a different name or file." : emptyDescription(filter)}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-mutedGray">{group.label}</h3>
              <ul className="flex flex-col divide-y divide-borderGray overflow-hidden rounded-xl border border-borderGray">
                {group.items.map((item) => (
                  <ActivityRow
                    key={item.id}
                    item={item}
                    machineId={machineId}
                    isOpen={openId === item.id}
                    onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
                  />
                ))}
              </ul>
            </section>
          ))}
          {visible.length > shown && (
            <Button size="sm" className="self-center" onClick={() => setShown((count) => count + PAGE_SIZE)}>
              Show more ({visible.length - shown})
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

const emptyTitle = (filter: Filter) =>
  filter === "session" ? "No remote sessions yet" : filter === "received" ? "No files from the tablet yet" : filter === "sent" ? "No files sent yet" : "No activity yet";

const emptyDescription = (filter: Filter) =>
  filter === "session"
    ? "Sessions appear here when they end, with their recording and transcript."
    : filter === "received"
      ? "Files the operator sends with Send to Portal appear here."
      : filter === "sent"
        ? "Designs sent to this machine from Machine Control appear here."
        : "Remote sessions and files sent to or from this tablet appear here.";

const Stat = ({ icon, tone, label, value }: { icon: IconName; tone: Tone; label: string; value: string }) => (
  <div className="flex items-center gap-3 rounded-xl border border-borderGray bg-surfaceGray px-3 py-2.5">
    <IconTile icon={icon} tone={tone} size="sm" />
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-xs text-bodyGray">{label}</span>
      <span className="truncate text-[15px] font-semibold tabular-nums text-ink">{value}</span>
    </div>
  </div>
);

interface ActivityRowProps {
  item: ActivityItem;
  machineId: string;
  isOpen: boolean;
  onToggle: () => void;
}

const ActivityRow = ({ item, machineId, isOpen, onToggle }: ActivityRowProps) => {
  const style = KIND_STYLE[item.kind];
  const time = timeFormat.format(new Date(item.at));

  if (item.kind === "received") {
    const { document } = item;
    return (
      <li className="flex flex-wrap items-center gap-3 bg-surface px-3.5 py-3">
        <IconTile icon={style.icon} tone={style.tone} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-medium text-ink" title={document.fileName}>
            {document.fileName}
          </span>
          <span className="text-xs text-bodyGray">
            Received from tablet · {time} · {formatFileSize(document.sizeBytes)} · {machineDocumentTypeLabels[document.documentType]}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <a href={document.signedUrl} target="_blank" rel="noreferrer" className={`${buttonBaseClasses} ${buttonVariantClasses.ghost} ${buttonSizeClasses.sm}`}>
            <Icon name="ext" className="h-3.5 w-3.5" />
            Open
          </a>
          <a href={document.downloadUrl} className={`${buttonBaseClasses} ${buttonVariantClasses.default} ${buttonSizeClasses.sm}`}>
            <Icon name="download" className="h-3.5 w-3.5" />
            Download
          </a>
        </div>
      </li>
    );
  }

  if (item.kind === "sent") {
    const { delivery, version } = item;
    const status = DELIVERY_STATUS[delivery.status];
    const files = version?.files ?? [];
    return (
      <li className="flex flex-col bg-surface">
        <button type="button" onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-surfaceGray">
          <IconTile icon={style.icon} tone={style.tone} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-medium text-ink">{delivery.project}</span>
            <span className="text-xs text-bodyGray">
              Sent to tablet · {time}
              {files.length > 0 && ` · ${files.length} ${files.length === 1 ? "file" : "files"}`}
            </span>
          </div>
          <Tag tone={status.tone}>{status.label}</Tag>
          <Icon name="chevd" className={`h-4 w-4 text-mutedGray transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen && (
          <div className="flex flex-col gap-2 border-t border-borderGray bg-surfaceGray px-3.5 py-3">
            {delivery.error && <p className="text-xs text-danger">{delivery.error}</p>}
            {files.length === 0 ? (
              <p className="text-xs text-mutedGray">The file list for this design isn&apos;t available.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {files.map((file, index) => (
                  <SentFile key={file.path} versionId={delivery.versionId} index={index} path={file.path} sizeBytes={file.sizeBytes} />
                ))}
              </ul>
            )}
          </div>
        )}
      </li>
    );
  }

  const { session } = item;
  const recording = sessionRecording(session);
  return (
    <li className="flex flex-col bg-surface">
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-surfaceGray">
        <IconTile icon={style.icon} tone={style.tone} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-medium text-ink">Remote session · {session.requesterName}</span>
          <span className="text-xs text-bodyGray">
            {[time, formatRemoteDuration(session.durationSeconds), remoteEndReasonLabel(session.endReason)].filter(Boolean).join(" · ")}
          </span>
        </div>
        <Tag tone={recording.tone}>
          {session.recordingStatus === "completed" && <Icon name="play" className="h-3 w-3" />}
          {recording.label}
        </Tag>
        <Icon name="chevd" className={`h-4 w-4 text-mutedGray transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="border-t border-borderGray bg-surfaceGray px-3.5 py-3">
          <RemoteSessionHistoryDetails machineId={machineId} session={session} />
        </div>
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
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-borderGray bg-surface px-3 py-2">
      <Icon name="file" className="h-4 w-4 text-mutedGray" />
      <span className="min-w-0 flex-1 truncate text-sm text-ink" title={path}>
        {path}
      </span>
      <span className="text-xs tabular-nums text-mutedGray">{formatFileSize(sizeBytes)}</span>
      <Button size="sm" variant="ghost" onClick={() => void download()} disabled={busy} aria-label={`Download ${path}`}>
        {busy ? <LoadingSpinner size="sm" /> : <Icon name="download" className="h-3.5 w-3.5" />}
      </Button>
      {error && <span className="w-full text-xs text-danger">{error}</span>}
    </li>
  );
};
