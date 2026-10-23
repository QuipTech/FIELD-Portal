"use client";

import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { OrganisationBilling } from "@/lib/types/billingAccount";
import { useBillingAccounts } from "../useBillingAccounts";
import { BillingAccountsTable } from "./billingAccountsTable";
import { BillingAccountModal } from "./billingAccountModal";

export const BillingAccountsManager = () => {
  const { organisations, isLoading, loadError, createAccount } = useBillingAccounts();
  const [settingUp, setSettingUp] = useState<OrganisationBilling | null>(null);
  const missingCount = organisations?.filter((organisation) => !organisation.billingAccount).length ?? 0;

  return (
    <>
      <div className="flex items-baseline">
        <h1 className="text-[22px] font-medium text-ink">Billing accounts</h1>
        {organisations && (
          <span className="ml-auto text-xs text-mutedGray">
            {missingCount === 0 ? "Every organisation is set up" : `${missingCount} without a billing account`}
          </span>
        )}
      </div>
      {isLoading && !organisations && (
        <span className="flex items-center gap-2 p-10 text-sm text-mutedGray">
          <LoadingSpinner /> Loading organisations…
        </span>
      )}
      {loadError && <span className="text-sm text-danger">{loadError}</span>}
      {organisations && <BillingAccountsTable organisations={organisations} onSetUp={setSettingUp} />}
      {organisations && (
        <p className="px-1 text-xs text-slate-400">
          An organisation needs a billing account before its machines can be activated.
        </p>
      )}
      {settingUp && (
        <BillingAccountModal organisation={settingUp} onCreate={createAccount} onClose={() => setSettingUp(null)} />
      )}
    </>
  );
};
