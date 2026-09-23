import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/listItem";
import { Tag } from "@/components/ui/tag";
import { recentActivity } from "@/lib/mockData/activity";

export const RecentActivityCard = () => {
  return (
    <Card className="flex-[1.35] gap-0.5">
      <div className="mb-1.5 flex items-baseline">
        <h2 className="text-base font-medium text-ink">Recent activity</h2>
        <Link href="/cases" className="ml-auto text-xs text-primary">
          View all
        </Link>
      </div>
      {recentActivity.map((item) => (
        <ListItem
          key={item.id}
          icon={item.icon}
          iconTone={item.iconTone}
          title={item.title}
          subtitle={item.caption}
          trailing={item.tag ? <Tag tone={item.tag.tone}>{item.tag.label}</Tag> : undefined}
        />
      ))}
    </Card>
  );
};
