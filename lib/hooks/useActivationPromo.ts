"use client";

import { useState } from "react";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { getPaymentTermsRequest, redeemPromoCodeRequest } from "@/lib/api/paymentTermsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { useApiResource } from "@/lib/hooks/useApiResource";
import type { PromoPreview } from "@/lib/types/paymentTerms";

export type AppliedPromo = Pick<
  PromoPreview,
  "code" | "summary" | "discountType" | "discountValue" | "startsMonth" | "endsMonth"
>;

// The promo code for an activation: the one already on the account, or a
// checked code that's redeemed just before the machines are activated.
// Promo codes need billing.manage, so others see neither.
export const useActivationPromo = () => {
  const { can } = usePermissions();
  const canUse = can(PERMISSIONS.manageBilling);
  const terms = useApiResource(
    (accessToken) => (canUse ? getPaymentTermsRequest(accessToken) : Promise.resolve(null)),
    [canUse],
    "Couldn't load your promo code.",
  );
  const [pending, setPending] = useState<PromoPreview | null>(null);
  const current: AppliedPromo | null = terms.data?.promo ?? null;

  // Called before activating, so a code that can't be used stops it.
  const redeemPending = async () => {
    if (!pending) return;
    await redeemPromoCodeRequest(requireAccessToken(), pending.code);
    setPending(null);
    terms.reload();
  };

  return {
    canUse,
    isLoading: canUse && terms.isLoading,
    current,
    pending,
    setPending,
    applied: current ?? pending,
    redeemPending,
  };
};

export type ActivationPromoState = ReturnType<typeof useActivationPromo>;
