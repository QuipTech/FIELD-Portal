"use client";

import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/linkButton";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { Tone } from "@/components/ui/tone";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { getOrganisationSubscriptionRequest } from "@/lib/api/organisationSubscriptionApi";
import { formatCalendarDate } from "@/lib/format/calendarDate";
import { formatSubscriptionCaption } from "@/lib/format/subscriptionCaption";
import type { OrganisationPlanStatus } from "@/lib/types/organisationSubscription";

interface SubscriptionSummaryCardProps {
  showBillingLink?: boolean;
}

const STATUS_TAGS: Record<OrganisationPlanStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "ok" },
  expiring_soon: { label: "Expiring soon", tone: "amber" },
  free: { label: "Free", tone: "default" },
};

// The organisation's plan, read from the backend; the free plan when it
// has no paid subscription (or it lapsed).
export const SubscriptionSummaryCard = ({ showBillingLink = false }: SubscriptionSummaryCardProps) => {
  const { data: subscription, isLoading, error } = useApiResource(
    getOrganisationSubscriptionRequest,
    [],
    "Couldn't load your subscription.",
  );

  if (!subscription) {
    return (
      <Card direction="row" className="items-center gap-3 text-mutedGray">
        {isLoading ? <LoadingSpinner /> : <span className="text-xs text-danger">{error}</span>}
      </Card>
    );
  }

  const isFree = subscription.status === "free";
  const statusTag = STATUS_TAGS[subscription.status];

  return (
    <Card direction="row" className="flex-wrap items-center gap-[18px]">
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-primaryTint text-primaryTintText">
        <Icon name={isFree ? "layers" : "shield"} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium text-ink">{subscription.planName} plan</span>
        <span className="text-xs text-mutedGray">{formatSubscriptionCaption(subscription)}</span>
      </div>
      {subscription.endsOn && (
        <div className="ml-6 flex flex-col gap-0.5">
          <span className="text-xs text-mutedGray">{subscription.renewsAutomatically ? "Renews" : "Ends"}</span>
          <span className="text-[15px] font-medium text-ink">{formatCalendarDate(subscription.endsOn)}</span>
        </div>
      )}
      <Tag tone={statusTag.tone} className={showBillingLink ? "" : "ml-auto"}>
        {statusTag.label}
      </Tag>
      {showBillingLink && (
        <div className="ml-auto flex gap-2">
          {!isFree && <LinkButton href="/settings/billing">Billing</LinkButton>}
          <LinkButton href="/settings/billing/upgrade" variant="primary">
            {isFree ? "Choose a plan" : "Upgrade plan"}
          </LinkButton>
        </div>
      )}
    </Card>
  );
};
