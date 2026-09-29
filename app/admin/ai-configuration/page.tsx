import { AdminShell } from "@/components/shell/adminShell";
import { AdminTopBar } from "@/components/shell/adminTopBar";
import { AiConfigurationDashboard } from "./components/aiConfigurationDashboard";

const AiConfigurationPage = () => {
  return (
    <AdminShell topBar={<AdminTopBar label="AI configuration" showBell={false} />}>
      <main className="m-4 flex flex-1 flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-surface p-6">
        <AiConfigurationDashboard />
      </main>
    </AdminShell>
  );
};

export default AiConfigurationPage;
