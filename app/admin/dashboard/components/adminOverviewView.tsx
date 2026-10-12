"use client";

import { StatCard } from "@/components/ui/statCard";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { getAdminOverviewRequest } from "@/lib/api/adminOverviewApi";
import type { AdminOverview } from "@/lib/types/adminOverview";
import { IngestionQueueCard } from "./ingestionQueueCard";
import { LatestActionsCard } from "./latestActionsCard";

const plural = (count: number, word: string) => `${count.toLocaleString("en-GB")} ${word}${count === 1 ? "" : "s"}`;

// "All organisations · 7 organisations · 3 sites" for the Owner; one
// organisation's name when the overview is narrowed to it.
const describeScope = ({ scope }: AdminOverview) =>
  [
    scope.isPlatform ? `All organisations · ${plural(scope.organisationCount, "organisation")}` : scope.organisationName,
    plural(scope.siteCount, "site"),
  ]
    .filter(Boolean)
    .join(" · ");

export const AdminOverviewView = () => {
  const overview = useApiResource(getAdminOverviewRequest, [], "Couldn't load the overview. Please try again.");
  const data = overview.data;

  return (
    <>
      <div className="flex items-baseline">
        <h1 className="text-[22px] font-medium text-ink">Overview</h1>
        {data && <span className="ml-auto text-xs text-mutedGray">{describeScope(data)}</span>}
      </div>
      {!data ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-mutedGray">
          {overview.isLoading ? (
            <>
              <LoadingSpinner /> Loading overview…
            </>
          ) : (
            <span className="text-danger">{overview.error}</span>
          )}
        </div>
      ) : (
        <>
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
            <StatCard
              label="Active users"
              value={data.users.active.toLocaleString("en-GB")}
              caption={data.users.invited ? `${data.users.invited} invited, not yet signed in` : "No pending invitations"}
              icon="users"
              tone="default"
            />
            <StatCard
              label="Documents indexed"
              value={data.documents.indexed.toLocaleString("en-GB")}
              caption={
                data.documents.searchablePagePercent === null
                  ? "No pages uploaded yet"
                  : `${data.documents.searchablePagePercent}% of uploaded pages searchable`
              }
              icon="book"
              tone="default"
            />
            <StatCard
              label="Assets in library"
              value={data.assets.total.toLocaleString("en-GB")}
              caption={`across ${plural(data.assets.modelCount, "model")}`}
              icon="db"
              tone="default"
            />
          </div>
          <div className="grid w-full min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
            <IngestionQueueCard entries={data.ingestionQueue} />
            <LatestActionsCard actions={data.latestActions} />
          </div>
        </>
      )}
    </>
  );
};
