import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/listItem";
import { Tag } from "@/components/ui/tag";
import type { IconName } from "@/components/icons/icon";
import type { Tone } from "@/components/ui/tone";
import { formatDayMonth } from "@/lib/format/elapsedTimeLabel";
import type { IngestionQueueEntry, IngestionQueueState } from "@/lib/types/adminOverview";

const STATE_STYLES: Record<IngestionQueueState, { label: string; tone: Tone; icon: IconName }> = {
  indexing: { label: "Indexing", tone: "default", icon: "file" },
  queued: { label: "Queued", tone: "default", icon: "file" },
  failed: { label: "Failed", tone: "danger", icon: "alert" },
  needs_review: { label: "Pending review", tone: "amber", icon: "check" },
};

const describeEntry = (entry: IngestionQueueEntry): string => {
  const pages = entry.pageCount ? `${entry.pageCount.toLocaleString("en-GB")} pages` : null;
  const parts =
    entry.state === "indexing"
      ? [pages, `${entry.progress}% indexed`]
      : entry.state === "queued"
        ? [entry.queuePosition && entry.queuePosition > 1 ? `Queued behind ${entry.queuePosition - 1} jobs` : "Next in line"]
        : entry.state === "failed"
          ? [entry.errorMessage ?? "Indexing failed"]
          : [entry.uploadedBy ? `Uploaded by ${entry.uploadedBy}` : null, formatDayMonth(new Date(entry.uploadedAt))];
  return [...parts, entry.organisationName].filter(Boolean).join(" · ");
};

export const IngestionQueueCard = ({ entries }: { entries: IngestionQueueEntry[] }) => {
  return (
    <Card className="gap-0.5">
      <div className="mb-1.5 flex items-baseline">
        <h2 className="text-base font-medium text-ink">Ingestion queue</h2>
        <Link href="/admin/knowledge" className="ml-auto text-xs text-primary">
          Knowledge
        </Link>
      </div>
      {entries.length === 0 && (
        <span className="py-6 text-center text-sm text-mutedGray">Nothing waiting — every document is searchable.</span>
      )}
      {entries.map((entry) => {
        const style = STATE_STYLES[entry.state];
        return (
          <ListItem
            key={entry.id}
            icon={style.icon}
            iconTone={entry.state === "failed" ? "danger" : entry.state === "needs_review" ? "amber" : "default"}
            title={entry.title}
            subtitle={describeEntry(entry)}
            trailing={<Tag tone={style.tone}>{style.label}</Tag>}
          />
        );
      })}
    </Card>
  );
};
