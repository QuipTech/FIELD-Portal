import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Card } from "@/components/ui/card";

interface SubscriptionSummaryCardProps {
  captionLine: string;
  showBillingLink?: boolean;
}

export const SubscriptionSummaryCard = ({ captionLine, showBillingLink = false }: SubscriptionSummaryCardProps) => {
  return (
    <Card direction="row" className="items-center gap-[18px]">
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-primaryTint text-primaryTintText">
        <Icon name="shield" />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium text-ink">Standard plan</span>
        <span className="text-xs text-mutedGray">{captionLine}</span>
      </div>
      <div className="ml-6 flex flex-col gap-0.5">
        <span className="text-xs text-mutedGray">Renews</span>
        <span className="text-[15px] font-medium text-ink">14 Apr 2027</span>
      </div>
      <Tag tone="ok" className={showBillingLink ? "" : "ml-auto"}>Active</Tag>
      {showBillingLink ? (
        <>
          <Link href="/settings/billing" className="ml-auto rounded-lg border border-borderGrayStrong px-3.5 py-1.5 text-[15px] font-medium text-ink">
            Billing
          </Link>
          <Link href="/settings/billing/upgrade" className="rounded-lg border border-primary bg-primary px-3.5 py-1.5 text-[15px] font-medium text-white">
            Upgrade plan
          </Link>
        </>
      ) : null}
    </Card>
  );
};
