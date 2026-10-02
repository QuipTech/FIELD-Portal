"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { ScheduledReport } from "@/lib/types/adminReports";
import { useScheduledReports } from "../useScheduledReports";
import { QuickExportGrid } from "./quickExportGrid";
import { ScheduledReportsTable } from "./scheduledReportsTable";
import { ScheduledReportModal } from "./scheduledReportModal";

type ScheduleDialog = { kind: "edit"; schedule?: ScheduledReport } | { kind: "delete"; schedule: ScheduledReport };

export const ReportsSettings = () => {
  const reports = useScheduledReports();
  const [dialog, setDialog] = useState<ScheduleDialog | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sendNow = (schedule: ScheduledReport) => {
    setActionError(null);
    reports
      .sendNow(schedule.id)
      .catch((error: unknown) => setActionError(toApiErrorMessage(error, "Couldn't send the report.")));
  };

  return (
    <>
      <div className="flex items-center">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Settings · Reports</span>
          <h1 className="text-xl font-bold text-slate-900">Reports &amp; exports</h1>
        </div>
        <button
          onClick={() => setDialog({ kind: "edit" })}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-[#4F39F6] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4330db]"
        >
          <Icon name="plus" className="h-4 w-4" />
          New scheduled report
        </button>
      </div>
      <div>
        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-800">Quick export</h2>
        <QuickExportGrid />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="mt-8 text-sm font-semibold text-slate-800">Scheduled reports</h2>
        {!reports.isEmailConfigured && (
          <span className="rounded-lg border border-amberBorder bg-amberTint px-3 py-2 text-xs text-amber">
            Email isn&apos;t set up on the server yet (REPORTS_EMAIL_FROM), so schedules are saved but not sent.
          </span>
        )}
        {actionError && <span className="text-xs text-danger">{actionError}</span>}
        {reports.isLoading && (
          <span className="flex items-center gap-2 py-6 text-sm text-mutedGray">
            <LoadingSpinner /> Loading scheduled reports…
          </span>
        )}
        {reports.loadError && <span className="text-sm text-danger">{reports.loadError}</span>}
        {!reports.isLoading && !reports.loadError && (
          <ScheduledReportsTable
            schedules={reports.schedules}
            onEdit={(schedule) => setDialog({ kind: "edit", schedule })}
            onSendNow={sendNow}
            onDelete={(schedule) => setDialog({ kind: "delete", schedule })}
          />
        )}
      </div>
      {dialog?.kind === "edit" && (
        <ScheduledReportModal
          schedule={dialog.schedule}
          onSave={(payload) => reports.saveSchedule(payload, dialog.schedule?.id)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title="Delete scheduled report"
          confirmLabel="Delete"
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the schedule. Please try again.")}
          onConfirm={() => reports.deleteSchedule(dialog.schedule.id)}
          onClose={() => setDialog(null)}
        >
          Stop sending <strong>{dialog.schedule.name}</strong>? Its recipients won&apos;t get it any more.
        </ConfirmDialog>
      )}
    </>
  );
};
