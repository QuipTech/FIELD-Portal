"use client";

import { useEffect, useState } from "react";
import { checkPersonalPayment } from "@/lib/api/personalBillingApi";
import { getAccessToken } from "@/lib/auth/authSession";
import { LinkButton } from "../ui/linkButton";

type PaymentReturn = "complete" | "cancelled";

const readPaymentReturn = (): PaymentReturn | null => {
  const value = new URLSearchParams(window.location.search).get("payment");
  return value === "complete" || value === "cancelled" ? value : null;
};

interface PaymentReturnBannerProps {
  paymentRequired: boolean | undefined;
  refresh: () => Promise<void>;
}

// Shown on the billing page Stripe Checkout returns to (?payment=complete or
// ?payment=cancelled). A completed payment is confirmed with Stripe straight
// away instead of waiting for the webhook.
export const PaymentReturnBanner = ({ paymentRequired, refresh }: PaymentReturnBannerProps) => {
  const [paymentReturn, setPaymentReturn] = useState<PaymentReturn | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);

  useEffect(() => {
    const returned = readPaymentReturn();
    setPaymentReturn(returned);
    if (returned !== "complete") return;
    const token = getAccessToken();
    if (!token) return;
    checkPersonalPayment(token).then(refresh).catch(() => setCheckFailed(true));
  }, [refresh]);

  if (!paymentReturn) return null;
  if (paymentReturn === "cancelled") return (
    <div role="status" className="rounded-xl border border-borderGray bg-surface p-4 text-sm text-bodyGray">
      Payment cancelled. You have not been charged; you can pay below whenever you are ready.
    </div>
  );
  if (paymentRequired === false) return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borderGray bg-surface p-4">
      <div>
        <p className="font-medium text-ink">Payment received. Thank you!</p>
        <p className="text-sm text-bodyGray">Your FIELD subscription is active for this month. Your receipt is in your invoices below and in your email.</p>
      </div>
      <LinkButton href="/dashboard">Continue to FIELD</LinkButton>
    </div>
  );
  return (
    <div role="status" className="rounded-xl border border-borderGray bg-surface p-4 text-sm text-bodyGray">
      {checkFailed
        ? "We couldn’t confirm your payment with Stripe yet. This page keeps checking; if you were charged, it will update shortly."
        : "Confirming your payment with Stripe…"}
    </div>
  );
};
