import { Icon } from "@/components/icons/icon";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { AssistantThreadSummary } from "@/lib/types/aiAssistant";

interface ThreadsRailProps {
  threads: AssistantThreadSummary[];
  activeThreadId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelect: (thread: AssistantThreadSummary) => void;
}

export const ThreadsRail = ({ threads, activeThreadId, isLoading, error, onSelect }: ThreadsRailProps) => {
  return (
    <nav className="flex w-52 flex-none flex-col gap-0.5 overflow-y-auto border-r border-borderGray bg-surface p-3">
      <span className="px-2.5 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-mutedGray">Threads</span>
      {isLoading && threads.length === 0 && (
        <span className="flex items-center gap-2 px-2.5 py-2 text-sm text-mutedGray">
          <LoadingSpinner /> Loading…
        </span>
      )}
      {error && <span className="px-2.5 py-2 text-xs text-danger">{error}</span>}
      {!isLoading && !error && threads.length === 0 && (
        <span className="px-2.5 py-2 text-sm text-mutedGray">Your questions will appear here.</span>
      )}
      {threads.map((thread) => {
        const isActive = thread.id === activeThreadId;
        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread)}
            aria-current={isActive || undefined}
            className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[15px] ${
              isActive ? "bg-primaryTint font-medium text-primaryHover" : "text-bodyGray hover:bg-fillGray"
            }`}
          >
            <Icon name="msg" className={`mt-0.5 flex-none ${isActive ? "stroke-primary" : "stroke-mutedGray"}`} />
            <span className="flex min-w-0 flex-col">
              <span className="leading-snug">{thread.title}</span>
              {thread.machine && <span className="text-xs font-normal text-mutedGray">{thread.machine.label}</span>}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
