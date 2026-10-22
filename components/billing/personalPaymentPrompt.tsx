"use client";

import { usePathname } from "next/navigation";
import { usePersonalBilling } from "@/lib/hooks/usePersonalBilling";
import { PersonalPaymentDialog } from "./personalPaymentDialog";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { LogoutButton } from "../shell/logoutButton";

const publicPaths = ["/login", "/register", "/verify-email", "/forgot-password", "/set-password", "/two-factor-setup", "/auth"];

export const PersonalPaymentPrompt = () => {
  const pathname = usePathname();
  const enabled = pathname !== "/" && !publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  // Billing remains reachable so users can inspect invoices while unpaid.
  const onBillingPage = pathname.startsWith("/settings/billing");
  const { status, error, refresh } = usePersonalBilling(enabled);
  if (!enabled || onBillingPage || status?.exempt) return null;
  if (error) return (
    <Modal title="Subscription status unavailable">
      <div className="flex flex-col gap-4 p-5">
        <p role="alert" className="text-sm text-bodyGray">{error}</p>
        <Button onClick={() => void refresh()}>Try again</Button>
        <LogoutButton className="flex items-center gap-2 text-sm text-bodyGray" />
      </div>
    </Modal>
  );
  return status?.paymentRequired ? <PersonalPaymentDialog status={status} refresh={refresh} /> : null;
};
