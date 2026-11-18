"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { PaymentTermsCard } from "@/components/billing/paymentTermsCard";
import { markBillingSetupSeen } from "@/components/billing/billingSetupBanner";
import { getPaymentTermsRequest } from "@/lib/api/paymentTermsApi";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";

// The sign-up billing step for a new organisation's admins: pay by card
// (the default) or apply for a 30-day account, and add a promo code.
// Nothing here blocks using FIELD.
const BillingOnboardingPage = () => {
  const { can } = usePermissions();
  const canManageBilling = can(PERMISSIONS.manageBilling);
  const terms = useApiResource(
    (token) => (canManageBilling ? getPaymentTermsRequest(token) : Promise.resolve(null)),
    [canManageBilling],
    "Couldn't load your organisation's billing.",
  );
  const billingAccountId = terms.data?.billingAccountId;
  useEffect(() => {
    if (billingAccountId) markBillingSetupSeen(billingAccountId);
  }, [billingAccountId]);

  return (
    <AppShell topBar={<TopBar><span className="text-[15px] text-bodyGray">Set up billing</span></TopBar>}>
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-medium text-ink">How will your organisation pay?</h1>
          <p className="max-w-2xl text-sm text-bodyGray">
            FIELD is billed to your organisation each month for its active machines only. There&apos;s no charge per user.
            Pay by card, or apply for a 30-day account to pay by bank transfer. You can change this later under Billing.
          </p>
        </div>
        {!canManageBilling && (
          <p className="rounded-xl border border-borderGray bg-surface p-5 text-sm text-bodyGray">
            Your organisation&apos;s administrators set up billing. There&apos;s nothing for you to do here.
          </p>
        )}
        {terms.isLoading && canManageBilling && !terms.data && (
          <span className="flex items-center gap-2 text-sm text-mutedGray">
            <LoadingSpinner /> Loading…
          </span>
        )}
        {terms.error && <p className="text-sm text-danger">{terms.error}</p>}
        {terms.data && (
          <>
            <PaymentTermsCard terms={terms.data} onChanged={terms.reload} />
            <p className="text-xs text-bodyGray">
              Paying by card: add your card under Billing → Payment methods once your first invoice is ready. Until then
              invoices are emailed with 14-day terms.
            </p>
          </>
        )}
        <div>
          <Link href="/dashboard">
            <Button variant="primary">Continue to dashboard</Button>
          </Link>
        </div>
      </main>
    </AppShell>
  );
};

export default BillingOnboardingPage;
