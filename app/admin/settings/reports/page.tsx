import { Icon } from "@/components/icons/icon";
import { QuickExportGrid } from "./components/quickExportGrid";
import { ScheduledReportsTable } from "./components/scheduledReportsTable";

const ReportsSettingsPage = () => {
  return (
    <>
      <div className="flex items-center">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Settings · Reports</span>
          <h1 className="text-xl font-bold text-slate-900">Reports &amp; exports</h1>
        </div>
        <button className="ml-auto flex items-center gap-1.5 rounded-xl bg-[#4F39F6] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4330db]">
          <Icon name="plus" className="h-4 w-4" />
          New scheduled report
        </button>
      </div>
      <div>
        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-800">Quick export</h2>
        <QuickExportGrid />
      </div>
      <div>
        <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-800">Scheduled reports</h2>
        <ScheduledReportsTable />
      </div>
    </>
  );
};

export default ReportsSettingsPage;
