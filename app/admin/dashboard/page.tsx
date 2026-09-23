import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { StatCard } from "@/components/ui/statCard";
import { IngestionQueueCard } from "./components/ingestionQueueCard";
import { LatestActionsCard } from "./components/latestActionsCard";

const AdminOverviewPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="Overview" />}>
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="m-4 flex flex-1 flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6">
          <div className="flex items-baseline">
            <h1 className="text-[22px] font-medium text-ink">Overview</h1>
            <span className="ml-auto text-xs text-mutedGray">QuipTech Mining · 3 sites</span>
          </div>
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
            <StatCard label="Active users" value="53" caption="4 invited, not yet signed in" icon="users" tone="default" />
            <StatCard
              label="Documents indexed"
              value="1,284"
              caption="86% of uploaded pages searchable"
              icon="book"
              tone="default"
            />
            <StatCard label="Assets in library" value="248" caption="across 19 models" icon="db" tone="default" />
          </div>
          <div className="grid w-full min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
            <IngestionQueueCard />
            <LatestActionsCard />
          </div>
        </main>
        <p className="mt-4 px-2 text-xs text-slate-400">
          Same app, same login as the portal — role (Technical Manager / System Administrator) decides which view
          you land in; the &ldquo;Admin view&rdquo; switcher returns to the technician portal.
        </p>
      </div>
    </AdminShell>
  );
};

export default AdminOverviewPage;
