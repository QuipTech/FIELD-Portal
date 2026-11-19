"use client";

import { useState } from "react";
import {
  getActivationPromoRequest,
  redeemActivationPromoRequest,
} from "@/lib/api/machineLifecycleApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { useApiResource } from "@/lib/hooks/useApiResource";
import type { PromoPreview } from "@/lib/types/paymentTerms";

export type AppliedPromo = Pick<
  PromoPreview,
  "code" | "summary" | "discountType" | "discountValue" | "startsMonth" | "endsMonth"
>;

// The promo code for an activation: the one already on the account, or a
// checked code that's redeemed just before the machines are activated.
// Anyone who can activate machines can use it (the dialog's own permission).
export const useActivationPromo = () => {
  const current = useApiResource(getActivationPromoRequest, [], "Couldn't load your promo code.");
  const [pending, setPending] = useState<PromoPreview | null>(null);
  const applied: AppliedPromo | null = current.data ?? pending;

  // Called before activating, so a code that can't be used stops it.
  const redeemPending = async () => {
    if (!pending) return;
    await redeemActivationPromoRequest(requireAccessToken(), pending.code);
    setPending(null);
    current.reload();
  };

  return {
    isLoading: current.isLoading,
    current: current.data,
    pending,
    setPending,
    applied,
    redeemPending,
  };
};

export type ActivationPromoState = ReturnType<typeof useActivationPromo>;
