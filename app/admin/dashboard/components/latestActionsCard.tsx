import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ListItem } from "@/components/ui/listItem";
import { latestAdminActions } from "@/lib/mockData/adminOverview";

export const LatestActionsCard = () => {
  return (
    <Card className="gap-0.5">
      <div className="mb-1.5 flex items-baseline">
        <h2 className="text-base font-medium text-ink">Latest admin actions</h2>
        <Link href="/admin/dashboard" className="ml-auto text-xs text-primary">
          Audit log
        </Link>
      </div>
      {latestAdminActions.map((action) => (
        <ListItem key={action.id} icon={action.icon} title={action.title} subtitle={action.caption} />
      ))}
    </Card>
  );
};
