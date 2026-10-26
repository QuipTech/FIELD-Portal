"use client";

import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { OrganisationBilling } from "@/lib/types/billingAccount";
import { useBillingAccounts } from "../useBillingAccounts";
import { BillingAccountsTable, type BillingAccountAction } from "./billingAccountsTable";
import { BillingAccountModal } from "./billingAccountModal";
import { BillingAccountActions } from "./billingAccountActions";

export const BillingAccountsManager = () => {
  const { organisations, isLoading, loadError, createAccount, reload } = useBillingAccounts();
  const [settingUp, setSettingUp] = useState<OrganisationBilling | null>(null);
  const [acting, setActing] = useState<{ organisation: OrganisationBilling; action: BillingAccountAction } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const missingCount = organisations?.filter((organisation) => !organisation.billingAccount).length ?? 0;

  return (
    <>
      <div className="flex items-baseline">
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
      {notice && <p role="status" className="text-sm text-bodyGray">{notice}</p>}
      {organisations && (
        <BillingAccountsTable
          organisations={organisations}
          onSetUp={setSettingUp}
          onAction={(organisation, action) => setActing({ organisation, action })}
        />
      )}
      {organisations && (
        <p className="px-1 text-xs text-slate-400">
          An organisation needs a billing account before its machines can be activated.
        </p>
      )}
      {acting && (
        <BillingAccountActions
          organisation={acting.organisation}
          action={acting.action}
          onDone={(message) => { setActing(null); setNotice(message); reload(); }}
          onClose={() => setActing(null)}
        />
      )}
      {settingUp && (
        <BillingAccountModal organisation={settingUp} onCreate={createAccount} onClose={() => setSettingUp(null)} />
      )}
    </>
  );
};
