import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/listItem";
import { Tag } from "@/components/ui/tag";
import { ingestionQueue } from "@/lib/mockData/adminOverview";

export const IngestionQueueCard = () => {
  return (
    <Card className="gap-0.5">
      <div className="mb-1.5 flex items-baseline">
        <h2 className="text-base font-medium text-ink">Ingestion queue</h2>
        <span className="ml-auto text-xs text-mutedGray">Updated 2 min ago</span>
      </div>
      {ingestionQueue.map((item) => (
        <ListItem
          key={item.id}
          icon={item.icon}
          iconTone={item.iconTone}
          title={item.title}
          subtitle={item.caption}
          trailing={<Tag tone={item.statusTone}>{item.statusLabel}</Tag>}
        />
      ))}
    </Card>
  );
};
