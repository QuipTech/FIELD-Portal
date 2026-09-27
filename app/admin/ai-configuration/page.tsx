import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { StatCard } from "@/components/ui/statCard";
import { QueriesPerDayCard } from "./components/queriesPerDayCard";
import { UsageBySiteCard } from "./components/usageBySiteCard";
import { PlatformAiCard } from "./components/platformAiCard";
import { PromptCard } from "./components/promptCard";
import { ReviewQueueTable } from "./components/reviewQueueTable";

const AiConfigurationPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="AI configuration" showBell={false} />}>
      <main className="m-4 flex flex-1 flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-6">
        <div className="flex items-baseline">
          <h1 className="text-[22px] font-medium text-ink">AI configuration</h1>
          <span className="ml-auto text-xs text-mutedGray">Usage · last 30 days</span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
          <StatCard label="Total queries" value="18,240" caption="↑ 12% vs prior 30d" icon="activity" tone="default" />
          <StatCard label="Active technicians" value="214" caption="of 260 licensed seats" icon="users" tone="default" />
          <StatCard label="Avg. cost / query" value="$0.038" caption="$693 total this period" icon="card" tone="default" />
          <StatCard label="Flagged for review" value="2" caption="of 41 flagged this period" icon="alert" tone="amber" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <QueriesPerDayCard />
          <UsageBySiteCard />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PlatformAiCard />
          <PromptCard />
        </div>
        <div className="flex items-baseline gap-2 border-t border-borderGray pt-4">
          <h2 className="text-base font-medium text-ink">Review queue</h2>
          <span className="text-xs text-mutedGray">Conversations flagged for admin review</span>
          <div className="ml-auto flex gap-2">
            <Tag tone="amber">Unreviewed · 2 <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
            <Tag>Reviewer <Icon name="chevd" className="h-3.5 w-3.5" /></Tag>
          </div>
        </div>
        <ReviewQueueTable />
        <p className="mt-3 px-1 text-xs text-slate-400">
          Flag reasons: no source found · low confidence · technician marked the answer wrong · safety refusal.
        </p>
      </main>
    </AdminShell>
  );
};

export default AiConfigurationPage;
