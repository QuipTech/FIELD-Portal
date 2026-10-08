import type { ReactNode } from "react";
import { SkeletonBar } from "@/components/ui/skeletonBar";
import { LoadErrorState } from "@/components/ui/loadErrorState";
import { Button } from "@/components/ui/button";
import type { HistoryEntry } from "@/lib/types/historyEntry";
import { HistoryTimelineEntry } from "./historyTimelineEntry";

interface HistoryTimelineProps {
  entries: HistoryEntry[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onDeletePhoto: (entryId: string, photoId: string) => Promise<void>;
  // Shown when there are no entries.
  emptyState: ReactNode;
}

export const HistoryTimeline = (props: HistoryTimelineProps) => {
  const { entries, isLoading, error, onRetry, hasMore, isLoadingMore, onLoadMore, onDeletePhoto, emptyState } = props;

  if (isLoading && entries.length === 0) {
    return (
      <div aria-busy="true" aria-label="Loading history" className="ml-2 flex flex-col gap-5 border-l border-borderGrayStrong py-3.5 pl-[18px]">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex flex-col gap-2">
            <SkeletonBar className="h-5 w-28" />
            <SkeletonBar className="h-5 w-2/3" />
            <SkeletonBar className="h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }
  if (error && entries.length === 0) return <LoadErrorState message={error} onRetry={onRetry} />;
  if (entries.length === 0) {
    return emptyState;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="ml-2 flex flex-col border-l border-borderGrayStrong pl-[18px]">
        {entries.map((entry) => (
          <HistoryTimelineEntry key={entry.id} entry={entry} onDeletePhoto={onDeletePhoto} />
        ))}
      </div>
      {error && <LoadErrorState message={error} onRetry={onLoadMore} />}
      {hasMore && !error && (
        <Button className="self-center" onClick={onLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
};
