import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { PersonalBillingView } from "./components/personalBillingView";

const BillingPage = () => {
  return (
    <AppShell topBar={<TopBar><span className="text-[15px] text-bodyGray">Billing &amp; subscription</span></TopBar>}>
      <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        <PersonalBillingView />
      </main>
    </AppShell>
  );
};

export default BillingPage;
