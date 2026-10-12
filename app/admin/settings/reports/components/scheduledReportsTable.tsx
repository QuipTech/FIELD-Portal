"use client";

import { ActionMenu } from "@/components/ui/actionMenu";
import { formatShortDate } from "@/lib/format/shortDate";
import type { ScheduledReport } from "@/lib/types/adminReports";
import { describeSchedule, REPORT_CATALOG } from "../reportCatalog";

interface ScheduledReportsTableProps {
  schedules: ScheduledReport[];
  onEdit: (schedule: ScheduledReport) => void;
  onSendNow: (schedule: ScheduledReport) => void;
  onDelete: (schedule: ScheduledReport) => void;
}

const headerClasses = "min-w-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400";

const describeRecipients = (recipients: string[]) =>
  recipients.length > 1 ? `${recipients[0]} +${recipients.length - 1}` : recipients[0];

const LastSent = ({ schedule }: { schedule: ScheduledReport }) => {
  if (schedule.isSending) return <span className="text-slate-500">Sending…</span>;
  if (schedule.lastStatus === "failed") {
    return (
      <span className="text-danger" title={schedule.lastError ?? undefined}>
        Failed
      </span>
    );
  }
  return <span className="text-slate-500">{schedule.lastSentAt ? formatShortDate(schedule.lastSentAt) : "Never"}</span>;
};

export const ScheduledReportsTable = ({ schedules, onEdit, onSendNow, onDelete }: ScheduledReportsTableProps) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-surface">
      <div className="flex gap-4 bg-slate-50/50 px-4 py-3">
        <span className={`${headerClasses} flex-[1.8]`}>Report</span>
        <span className={`${headerClasses} flex-[1.4]`}>Frequency</span>
        <span className={`${headerClasses} flex-[1.4]`}>Recipients</span>
        <span className={`${headerClasses} flex-[0.7]`}>Format</span>
        <span className={`${headerClasses} flex-[0.8]`}>Last sent</span>
        <span className="w-[34px] flex-none" />
      </div>
      {schedules.length === 0 && (
        <div className="border-t border-slate-200/80 px-4 py-6 text-sm text-mutedGray">
          No scheduled reports yet. Add one with New scheduled report.
        </div>
      )}
      {schedules.map((schedule) => (
        <div key={schedule.id} className="flex items-center gap-4 border-t border-slate-200/80 px-4 py-3.5">
          <span className="flex min-w-0 flex-[1.8] flex-col">
            <span className="truncate text-sm font-medium text-slate-800">{schedule.name}</span>
            <span className="text-xs text-mutedGray">
              {REPORT_CATALOG.find((item) => item.type === schedule.reportType)?.title}
            </span>
          </span>
          <span className="min-w-0 flex-[1.4] text-sm text-slate-500" title={schedule.timezone}>
            {describeSchedule(schedule)}
          </span>
          <span className="min-w-0 flex-[1.4] truncate text-sm text-slate-500" title={schedule.recipients.join(", ")}>
            {describeRecipients(schedule.recipients)}
          </span>
          <span className="min-w-0 flex-[0.7]">
            <span className="inline-flex rounded-md border border-slate-200 px-2 py-0.5 text-xs uppercase text-slate-600">
              {schedule.format}
            </span>
          </span>
          <span className="min-w-0 flex-[0.8] text-sm">
            <LastSent schedule={schedule} />
          </span>
          <ActionMenu
            label={schedule.name}
            items={[
              { label: "Edit", icon: "file", onSelect: () => onEdit(schedule) },
              { label: "Send now", icon: "upload", onSelect: () => onSendNow(schedule) },
              { label: "Delete", icon: "x", tone: "danger", onSelect: () => onDelete(schedule) },
            ]}
          />
        </div>
      ))}
    </div>
  );
};
