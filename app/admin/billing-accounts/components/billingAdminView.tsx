"use client";

import { useState } from "react";
import { InvoicesOverview } from "./invoicesOverview";
import { BillingAccountsManager } from "./billingAccountsManager";
import { OnboardingPanel } from "./onboardingPanel";
import { ReviewTasksPanel } from "./reviewTasksPanel";
import { PricesAndSettingsPanel } from "./pricesAndSettingsPanel";
import { AccountApplicationsPanel } from "./accountApplicationsPanel";
import { OverduePanel } from "./overduePanel";
import { PromoCodesPanel } from "./promoCodesPanel";
import { MonthEndReportPanel } from "./monthEndReportPanel";

const TABS = [
  { id: "monthEnd", label: "Month-end report" },
  { id: "invoices", label: "Invoices" },
  { id: "accounts", label: "Billing accounts" },
  { id: "applications", label: "Account applications" },
  { id: "overdue", label: "Overdue" },
  { id: "promo", label: "Promo codes" },
  { id: "tasks", label: "Review tasks" },
  { id: "onboarding", label: "Onboarding" },
  { id: "prices", label: "Prices & settings" },
] as const;

const PANELS: Record<TabId, () => JSX.Element> = {
  monthEnd: MonthEndReportPanel,
  invoices: InvoicesOverview,
  accounts: BillingAccountsManager,
  applications: AccountApplicationsPanel,
  overdue: OverduePanel,
  promo: PromoCodesPanel,
  tasks: ReviewTasksPanel,
  onboarding: OnboardingPanel,
  prices: PricesAndSettingsPanel,
};

type TabId = (typeof TABS)[number]["id"];

// The platform admin's billing page: the month-end report of 30-day
// account statements (invoiced in Zoho), every user's and organisation's
// Stripe invoices, billing accounts (suspension, card or account, free periods,
// Enterprise, onboarding), 30-day account applications, overdue invoices,
// promo codes, review tasks, onboarding jobs, and prices and settings.
export const BillingAdminView = () => {
  const [tab, setTab] = useState<TabId>("monthEnd");
  const Panel = PANELS[tab];
  return (
    <>
      <h1 className="text-[22px] font-medium text-ink">Billing</h1>
      <div role="tablist" aria-label="Billing" className="flex flex-none gap-1 overflow-x-auto border-b border-borderGray">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === item.id ? "border-primary font-medium text-ink" : "border-transparent text-bodyGray hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Panel />
    </>
  );
};
