import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { SubscriptionsManager } from "./components/subscriptionsManager";

const SubscriptionsPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="All subscriptions" />}>
      <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-5">
        <SubscriptionsManager />
      </main>
    </AdminShell>
  );
};

export default SubscriptionsPage;
