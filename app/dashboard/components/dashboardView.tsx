"use client";

import Link from "next/link";
import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { CollapsibleSearch } from "@/components/shell/collapsibleSearch";
import { Tag } from "@/components/ui/tag";
import { StatCard } from "@/components/ui/statCard";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { useSignedInProfile } from "@/lib/auth/useSignedInProfile";
import { getDashboardRequest } from "@/lib/api/dashboardApi";
import { getOrganisationSubscriptionRequest } from "@/lib/api/organisationSubscriptionApi";
import type { DashboardSummary } from "@/lib/types/dashboard";
import { FleetUptimeCard } from "./fleetUptimeCard";
import { CasesByPriorityCard } from "./casesByPriorityCard";
import { RecentActivityCard } from "./recentActivityCard";
import { MyMachinesCard } from "./myMachinesCard";
import { PortalGuideModal } from "./portalGuideModal";

const DOWN_LABELS_SHOWN = 3;

const describeOpenCases = ({ openCases }: DashboardSummary) => {
  if (openCases.total === 0) return "No open cases";
  return openCases.breachingSla > 0 ? `${openCases.breachingSla} breaching SLA` : "None breaching SLA";
};

const describeDownMachines = ({ machinesDown }: DashboardSummary) => {
  if (machinesDown.total === 0) return "Every machine is up";
  const labels = machinesDown.machines.map((machine) => machine.label).join(" · ");
  const more = machinesDown.total - DOWN_LABELS_SHOWN;
  return more > 0 ? `${labels} +${more} more` : labels;
};

const todayLabel = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

const DashboardTopBar = () => {
  const profile = useSignedInProfile();
  const subscription = useApiResource(getOrganisationSubscriptionRequest, [], "Couldn't load your plan.");
  const role = profile?.user.roles[0];

  return (
    <TopBar
      actions={
        <>
          {subscription.data && (
            <Link href="/settings/billing">
              <Tag tone="primary">{subscription.data.planName} plan</Tag>
            </Link>
          )}
          <Link href="/settings/billing/upgrade">
            <Tag>Upgrade</Tag>
          </Link>
          {role && <Tag tone="primary">{[role, profile?.tenant?.name].filter(Boolean).join(" · ")}</Tag>}
        </>
      }
    >
      <CollapsibleSearch placeholder="Search machines, manuals, cases" />
    </TopBar>
  );
};

export const DashboardView = () => {
  const dashboard = useApiResource(getDashboardRequest, [], "Couldn't load the dashboard. Please try again.");
  const profile = useSignedInProfile();
  const summary = dashboard.data;

  return (
    <AppShell topBar={<DashboardTopBar />}>
      <main className="relative flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-baseline">
          <h1 className="text-[22px] font-medium text-ink">Dashboard</h1>
          <span className="ml-auto text-xs text-mutedGray">
            {[profile?.tenant?.name, todayLabel()].filter(Boolean).join(" · ")}
          </span>
        </div>
        {!summary ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-mutedGray">
            {dashboard.isLoading ? (
              <>
                <LoadingSpinner /> Loading dashboard…
              </>
            ) : (
              <span className="text-danger">{dashboard.error}</span>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <Link href="/cases" className="flex flex-1">
                <StatCard label="Open cases" value={String(summary.openCases.total)} caption={describeOpenCases(summary)} icon="life" tone="amber" />
              </Link>
              <Link href="/machines" className="flex flex-1">
                <StatCard label="Machines down" value={String(summary.machinesDown.total)} caption={describeDownMachines(summary)} icon="alert" tone="danger" />
              </Link>
              <StatCard
                label="Entries this week"
                value={String(summary.entriesThisWeek.total)}
                caption={`${summary.entriesThisWeek.mine} logged by you`}
                icon="file"
                tone="primary"
              />
            </div>
            <div className="flex gap-3">
              <FleetUptimeCard uptime={summary.fleetUptime} />
              <CasesByPriorityCard byPriority={summary.openCases.byPriority} />
            </div>
            <div className="flex min-h-0 flex-1 gap-3">
              <RecentActivityCard items={summary.recentActivity} />
              <MyMachinesCard machines={summary.myMachines} />
            </div>
          </>
        )}
        <PortalGuideModal />
      </main>
    </AppShell>
  );
};
