import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { BillingAccountsManager } from "./components/billingAccountsManager";

const BillingAccountsPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Billing accounts" />}>
      <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-5">
        <BillingAccountsManager />
      </main>
    </AdminShell>
  );
};

export default BillingAccountsPage;
