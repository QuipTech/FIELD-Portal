import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { PlanCard } from "./components/planCard";

const UpgradePlanPage = () => {
  return (
    <div className="flex min-h-screen flex-col bg-surfaceGray">
      <div className="flex h-14 flex-none items-center border-b border-borderGray bg-white px-4">
        <span className="text-[15px] font-medium text-ink">Upgrade plan</span>
        <Link href="/settings/billing" className="ml-auto text-bodyGray">
          <Icon name="x" />
        </Link>
      </div>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <span className="text-xs text-mutedGray">
          Choose the plan that fits your fleet — change or cancel any time in Stripe
        </span>
        <div className="flex flex-1 gap-4">
          <PlanCard
            name="Standard"
            badgeLabel="Current plan"
            badgeTone="default"
            billingNote="Per asset, monthly"
            features={[
              "CMDB, config snapshots & diff",
              "AI assistant, included query allowance",
              "Knowledge base & standard support",
            ]}
            action={<Button className="w-full">Current plan</Button>}
          />
          <PlanCard
            name="Enterprise"
            badgeLabel="Recommended"
            badgeTone="primary"
            billingNote="Annual, negotiated"
            highlighted
            features={["Everything in Standard", "White-label, SSO/SAML", "Priority support, named contact"]}
            action={
              <Button variant="primary" className="w-full">
                <Icon name="ext" />
                Continue to Stripe checkout
              </Button>
            }
          />
        </div>
        <p className="text-xs text-mutedGray">
          You&apos;ll be redirected to Stripe to confirm payment — QuipTech FIELD never sees or stores your card
          details.
        </p>
      </main>
    </div>
  );
};

export default UpgradePlanPage;
