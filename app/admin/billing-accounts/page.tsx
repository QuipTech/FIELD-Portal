import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { BillingAdminView } from "./components/billingAdminView";

const BillingAccountsPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Billing" />}>
      <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-5">
        <BillingAdminView />
      </main>
    </AdminShell>
  );
};

export default BillingAccountsPage;
