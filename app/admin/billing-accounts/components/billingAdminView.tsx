"use client";

import { useState } from "react";
import { InvoicesOverview } from "./invoicesOverview";
import { BillingAccountsManager } from "./billingAccountsManager";

const TABS = [
  { id: "invoices", label: "Invoices" },
  { id: "accounts", label: "Billing accounts" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// The platform admin's billing page: every user's and organisation's
// invoices, and the organisations' billing accounts.
export const BillingAdminView = () => {
  const [tab, setTab] = useState<TabId>("invoices");
  return (
    <>
      <h1 className="text-[22px] font-medium text-ink">Billing</h1>
      <div role="tablist" aria-label="Billing" className="flex gap-1 border-b border-borderGray">
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
      {tab === "invoices" ? <InvoicesOverview /> : <BillingAccountsManager />}
    </>
  );
};
