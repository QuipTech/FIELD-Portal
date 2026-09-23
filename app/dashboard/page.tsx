import Link from "next/link";
import { AppShell } from "@/components/shell/appShell";
import { TopBar } from "@/components/shell/topBar";
import { CollapsibleSearch } from "@/components/shell/collapsibleSearch";
import { Tag } from "@/components/ui/tag";
import { IconButton } from "@/components/ui/iconButton";
import { StatCard } from "@/components/ui/statCard";
import { FleetUptimeCard } from "./components/fleetUptimeCard";
import { CasesByPriorityCard } from "./components/casesByPriorityCard";
import { RecentActivityCard } from "./components/recentActivityCard";
import { MyMachinesCard } from "./components/myMachinesCard";
import { PortalGuideModal } from "./components/portalGuideModal";

const DashboardPage = () => {
  return (
    <AppShell
      topBar={
        <TopBar
          actions={
            <>
              <Link href="/settings/billing"><Tag tone="primary">Standard plan</Tag></Link>
              <Link href="/settings/billing/upgrade"><Tag>Upgrade</Tag></Link>
              <Tag tone="primary">Technician · Pit 4</Tag>
              <IconButton icon="bell" tone="amber" />
            </>
          }
        >
          <CollapsibleSearch placeholder="Search machines, manuals, cases" />
        </TopBar>
      }
    >
      <main className="relative flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-baseline">
          <h1 className="text-[22px] font-medium text-ink">Dashboard</h1>
          <span className="ml-auto text-xs text-mutedGray">Pit 4 · Thursday 19 March</span>
        </div>
        <div className="flex gap-3">
          <StatCard label="Open cases" value="7" caption="2 breaching SLA today" icon="life" tone="amber" />
          <StatCard label="Machines down" value="2" caption="HT-2201 · DZ-118" icon="alert" tone="danger" />
          <StatCard label="Entries this week" value="34" caption="9 logged by you" icon="file" tone="primary" />
        </div>
        <div className="flex gap-3">
          <FleetUptimeCard />
          <CasesByPriorityCard />
        </div>
        <div className="flex min-h-0 flex-1 gap-3">
          <RecentActivityCard />
          <MyMachinesCard />
        </div>
        <PortalGuideModal />
      </main>
    </AppShell>
  );
};

export default DashboardPage;
