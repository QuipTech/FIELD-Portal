import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/listItem";
import { Tag } from "@/components/ui/tag";
import type { IconName } from "@/components/icons/icon";
import { formatElapsedTime } from "@/lib/format/elapsedTimeLabel";
import type { ActivityItem, ActivityKind } from "@/lib/types/dashboard";

const KIND_ICONS: Record<ActivityKind, IconName> = {
  case: "life",
  history_entry: "wrench",
  ai_thread: "spark",
  knowledge: "book",
};

export const RecentActivityCard = ({ items }: { items: ActivityItem[] }) => {
  return (
    <Card className="flex-[1.35] gap-0.5">
      <div className="mb-1.5 flex items-baseline">
        <h2 className="text-base font-medium text-ink">Recent activity</h2>
        <Link href="/cases" className="ml-auto text-xs text-primary">
          View all
        </Link>
      </div>
      {items.length === 0 && (
        <span className="py-6 text-center text-sm text-mutedGray">
          Cases, history entries, AI threads and new documents will show up here.
        </span>
      )}
      {items.map((item) => (
        <Link key={item.id} href={item.href} className="rounded-lg hover:bg-fillGray/60">
          <ListItem
            icon={KIND_ICONS[item.kind]}
            iconTone={item.kind === "case" ? "amber" : "default"}
            title={item.title}
            subtitle={[item.caption, formatElapsedTime(new Date(item.occurredAt))].filter(Boolean).join(" · ")}
            trailing={item.tag ? <Tag tone={item.tag.tone}>{item.tag.label}</Tag> : undefined}
          />
        </Link>
      ))}
    </Card>
  );
};
