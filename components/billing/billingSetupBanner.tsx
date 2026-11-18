"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getPaymentTermsRequest } from "@/lib/api/paymentTermsApi";
import { getAccessToken } from "@/lib/auth/authSession";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import type { OrganisationPaymentTerms } from "@/lib/types/paymentTerms";

const dismissedKey = (billingAccountId: string) => `field.billingSetupDismissed.${billingAccountId}`;

const readDismissed = (billingAccountId: string): boolean => {
  try {
    return window.localStorage.getItem(dismissedKey(billingAccountId)) === "1";
  } catch {
    return false;
  }
};

// Visiting the set-up step counts as seeing it: card is a valid choice.
export const markBillingSetupSeen = (billingAccountId: string) => {
  try {
    window.localStorage.setItem(dismissedKey(billingAccountId), "1");
  } catch {
    // Private mode: the banner just shows again next time.
  }
};

// A new organisation hasn't chosen how it pays yet: no account application,
// no promo code and still on the default card terms.
export const needsBillingSetup = (terms: OrganisationPaymentTerms): boolean =>
  terms.accountStatus === "none" && terms.paymentType === "card" && !terms.promo;

// Shown to a new organisation's billing admins on the dashboard until they
// choose card or a 30-day account (or dismiss it). Nothing is blocked
// either way: card is the default.
export const BillingSetupBanner = () => {
  const { can } = usePermissions();
  const canManageBilling = can(PERMISSIONS.manageBilling);
  const [terms, setTerms] = useState<OrganisationPaymentTerms | null>(null);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!canManageBilling || !token) return;
    let isCurrent = true;
    getPaymentTermsRequest(token)
      .then((loaded) => {
        if (!isCurrent) return;
        setTerms(loaded);
        setIsDismissed(readDismissed(loaded.billingAccountId));
      })
      // No billing account yet, or the API is down: say nothing.
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [canManageBilling]);

  if (!terms || isDismissed || !needsBillingSetup(terms)) return null;

  const dismiss = () => {
    markBillingSetupSeen(terms.billingAccountId);
    setIsDismissed(true);
  };

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-primaryBorder bg-primaryTint p-4 text-sm text-primaryTintText">
      <span className="flex-1">
        Choose how your organisation pays for FIELD: by card, or apply for a 30-day account. You can also add a promo code.
      </span>
      <Link href="/onboarding/billing">
        <Button size="sm" variant="primary">
          Choose how to pay
        </Button>
      </Link>
      <Button size="sm" variant="ghost" onClick={dismiss}>
        Not now
      </Button>
    </section>
  );
};
