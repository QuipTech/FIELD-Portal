import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { Tag } from "@/components/ui/tag";
import { SubscriptionsTable } from "./components/subscriptionsTable";

const SubscriptionsPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="All subscriptions" />}>
      <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-5">
        <div className="flex items-baseline">
          <h1 className="text-[22px] font-medium text-ink">All subscriptions</h1>
          <span className="ml-auto text-xs text-mutedGray">6 tenants</span>
        </div>
        <div className="flex items-center gap-2">
          <Tag tone="primary">All</Tag>
          <Tag>Active</Tag>
          <Tag tone="amber">Expiring soon</Tag>
          <Tag tone="danger">Expired</Tag>
        </div>
        <SubscriptionsTable />
      </main>
    </AdminShell>
  );
};

export default SubscriptionsPage;
