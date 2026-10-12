"use client";

import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS } from "@/lib/auth/permissionCodes";
import { getAiPlatformRequest, getAiUsageRequest } from "@/lib/api/aiConfigurationApi";
import { UsageStatCards } from "./usageStatCards";
import { QueriesPerDayCard } from "./queriesPerDayCard";
import { UsageByOrganisationCard } from "./usageByOrganisationCard";
import { OtherAiUsageCard } from "./otherAiUsageCard";
import { PlatformAiCard } from "./platformAiCard";
import { PromptCard } from "./promptCard";
import { ReviewQueueSection } from "./reviewQueueSection";

const USAGE_PERIOD_DAYS = 30;

export const AiConfigurationDashboard = () => {
  const usage = useApiResource(
    (accessToken) => getAiUsageRequest(accessToken, USAGE_PERIOD_DAYS),
    [],
    "Couldn't load AI usage. Please try again.",
  );
  const platform = useApiResource(getAiPlatformRequest, [], "Couldn't load the platform AI setup.");
  // The assistant prompt is platform-wide, so only the Owner edits it.
  const { can } = usePermissions();

  return (
    <>
      <div className="flex items-baseline">
        <h1 className="text-[22px] font-medium text-ink">AI configuration</h1>
        <span className="ml-auto text-xs text-mutedGray">Usage · last {USAGE_PERIOD_DAYS} days</span>
      </div>
      {usage.isLoading && (
        <span className="flex items-center gap-2 py-6 text-sm text-mutedGray">
          <LoadingSpinner /> Loading usage…
        </span>
      )}
      {usage.error && <span className="text-sm text-danger">{usage.error}</span>}
      {usage.data && (
        <>
          <UsageStatCards usage={usage.data} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <QueriesPerDayCard
              queriesPerDay={usage.data.queriesPerDay}
              averageQueriesPerDay={usage.data.averageQueriesPerDay}
            />
            <UsageByOrganisationCard rows={usage.data.usageByOrganisation} />
            <OtherAiUsageCard rows={usage.data.otherUsage} />
          </div>
        </>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {platform.data ? (
          <PlatformAiCard platform={platform.data} />
        ) : (
          <span className="text-sm text-mutedGray">{platform.error ?? "Loading platform AI…"}</span>
        )}
        {can(PERMISSIONS.managePlatform) && <PromptCard />}
      </div>
      <ReviewQueueSection />
    </>
  );
};
