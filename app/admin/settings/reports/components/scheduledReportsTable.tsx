import { scheduledReports } from "@/lib/mockData/reportsExports";

export const ScheduledReportsTable = () => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
      <div className="flex gap-4 bg-slate-50/50 px-4 py-3">
        <span className="min-w-0 flex-[1.8] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Report
        </span>
        <span className="min-w-0 flex-[1.4] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Frequency
        </span>
        <span className="min-w-0 flex-[1.4] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Recipients
        </span>
        <span className="min-w-0 flex-[0.7] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Format
        </span>
        <span className="min-w-0 flex-[0.8] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Last sent
        </span>
      </div>
      {scheduledReports.map((report) => (
        <div key={report.id} className="flex items-center gap-4 border-t border-slate-200/80 px-4 py-3.5">
          <span className="min-w-0 flex-[1.8] text-sm font-medium text-slate-800">{report.name}</span>
          <span className="min-w-0 flex-[1.4] text-sm text-slate-500">{report.frequency}</span>
          <span className="min-w-0 flex-[1.4] text-sm text-slate-500">{report.recipients}</span>
          <span className="min-w-0 flex-[0.7]">
            <span className="inline-flex rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
              {report.format}
            </span>
          </span>
          <span className="min-w-0 flex-[0.8] text-sm text-slate-500">{report.lastSentLabel}</span>
        </div>
      ))}
    </div>
  );
};
