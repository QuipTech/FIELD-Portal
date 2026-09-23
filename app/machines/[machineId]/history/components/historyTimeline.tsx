import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { historyEntries } from "@/lib/mockData/historyEntries";
import { historyEntryTypeMeta } from "@/lib/types/historyEntry";

export const HistoryTimeline = () => {
  return (
    <div className="ml-2 flex flex-1 flex-col gap-0 border-l border-borderGrayStrong pl-[18px]">
      {historyEntries.map((entry) => {
        const meta = historyEntryTypeMeta[entry.type];
        return (
          <div key={entry.id} className="flex flex-col gap-2 border-b border-borderGray py-3.5 last:border-b-0">
            <div className="flex items-center">
              <Tag tone={meta.tone}>
                <Icon name={meta.icon} className="h-3.5 w-3.5" />
                {entry.type}
              </Tag>
              <span className="ml-auto text-xs text-mutedGray">{entry.authorLabel}</span>
            </div>
            <span className="text-[15px] font-medium text-ink">{entry.title}</span>
            <span className="text-xs text-mutedGray">{entry.detail}</span>
            {entry.hasPhotos ? (
              <div className="flex gap-2">
                <div className="flex h-12 w-16 items-center justify-center rounded-lg border border-borderGrayStrong bg-fillGray text-mutedGray">
                  <Icon name="image" className="h-3.5 w-3.5" />
                </div>
                <div className="flex h-12 w-16 items-center justify-center rounded-lg border border-borderGrayStrong bg-fillGray text-mutedGray">
                  <Icon name="image" className="h-3.5 w-3.5" />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
