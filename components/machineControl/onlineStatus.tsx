import { formatElapsedTime } from "@/lib/format/elapsedTimeLabel";

interface OnlineStatusProps {
  online: boolean;
  lastSeenAt: string | null;
}

// A green, pulsing dot while the tablet is connected; grey with when it was
// last seen otherwise.
export const OnlineStatus = ({ online, lastSeenAt }: OnlineStatusProps) => (
  <span className="inline-flex items-center gap-2 text-[13px]">
    <span className="relative flex h-2.5 w-2.5 flex-none">
      {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-borderGrayStrong"}`} />
    </span>
    <span className={online ? "font-medium text-ink" : "text-bodyGray"}>
      {online ? "Online" : lastSeenAt ? `Last seen ${formatElapsedTime(new Date(lastSeenAt)).toLowerCase()}` : "Waiting for the tablet"}
    </span>
  </span>
);
