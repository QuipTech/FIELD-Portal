import Link from "next/link";
import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { SettingsRow } from "@/components/settings/settingsRow";
import { SubscriptionSummaryCard } from "@/components/settings/subscriptionSummaryCard";
import { AiAllowanceCard } from "./components/aiAllowanceCard";
import { AddOnsRow } from "./components/addOnsRow";
import { InvoicesTable } from "./components/invoicesTable";

const BillingPage = () => {
  return (
    <AppShell topBar={<TopBar><span className="text-[15px] text-bodyGray">Billing &amp; subscription</span></TopBar>}>
      <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        <div className="flex items-center">
          <h1 className="text-[22px] font-medium text-ink">Billing &amp; subscription</h1>
          <Link
            href="/settings/billing/upgrade"
            className="ml-auto rounded-lg border border-primary bg-primary px-3.5 py-2 text-[15px] font-medium text-white"
          >
            Upgrade plan
          </Link>
        </div>
        <SubscriptionSummaryCard captionLine="Billed per asset, monthly · 42 assets" />

        <h2 className="text-base font-medium text-ink">AI query allowance</h2>
        <AiAllowanceCard />

        <h2 className="text-base font-medium text-ink">Add-ons</h2>
        <AddOnsRow />

        <h2 className="text-base font-medium text-ink">Payment method</h2>
        <div className="rounded-xl border border-borderGray bg-white">
          <SettingsRow
            icon="card"
            title="Visa •••• 4242"
            caption="Expires 08/29 · processed securely by Stripe"
            bordered={false}
            trailing={
              <span className="rounded-lg border border-borderGrayStrong px-2.5 py-1.5 text-[13px] text-ink">
                Manage in Stripe
              </span>
            }
          />
        </div>

        <h2 className="text-base font-medium text-ink">Invoices</h2>
        <InvoicesTable />
        <p className="text-xs text-mutedGray">
          Payments, invoices and card details are handled entirely by Stripe — QuipTech FIELD never stores your
          card number.
        </p>
      </main>
    </AppShell>
  );
};

export default BillingPage;
