"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/selectInput";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { ReportType, ScheduledReport, ScheduledReportPayload } from "@/lib/types/adminReports";
import { REPORT_CATALOG } from "../reportCatalog";
import { ScheduleTimingFields, type ScheduleTiming } from "./scheduleTimingFields";

interface ScheduledReportModalProps {
  // Omit to create a new schedule.
  schedule?: ScheduledReport;
  onSave: (payload: ScheduledReportPayload) => Promise<void>;
  onClose: () => void;
}

const SAVE_FAILED_MESSAGE = "Couldn't save the schedule. Please try again.";
const MAX_RECIPIENTS = 20;
const fieldLabelClasses = "text-xs font-medium uppercase tracking-wide text-mutedGray";

const parseRecipients = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);

const toInitialTiming = (schedule?: ScheduledReport): ScheduleTiming => ({
  frequency: schedule?.frequency ?? "weekly",
  dayOfWeek: schedule?.dayOfWeek ?? 1,
  dayOfMonth: schedule?.dayOfMonth ?? 1,
  sendHour: schedule?.sendHour ?? 6,
});

export const ScheduledReportModal = ({ schedule, onSave, onClose }: ScheduledReportModalProps) => {
  const [name, setName] = useState(schedule?.name ?? "");
  const [reportType, setReportType] = useState<ReportType>(schedule?.reportType ?? "fleet_uptime");
  const [timing, setTiming] = useState(() => toInitialTiming(schedule));
  const [recipientsText, setRecipientsText] = useState(schedule?.recipients.join(", ") ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // An edit keeps its zone; a new schedule uses the browser's.
  const timezone = schedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const recipients = parseRecipients(recipientsText);
  const isComplete = Boolean(name.trim()) && recipients.length > 0 && recipients.length <= MAX_RECIPIENTS;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isComplete) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        name: name.trim(),
        reportType,
        frequency: timing.frequency,
        dayOfWeek: timing.frequency === "weekly" ? timing.dayOfWeek : undefined,
        dayOfMonth: timing.frequency === "monthly" ? timing.dayOfMonth : undefined,
        sendHour: timing.sendHour,
        timezone,
        recipients,
      });
      onClose();
    } catch (error) {
      setSaveError(toApiErrorMessage(error, SAVE_FAILED_MESSAGE));
      setIsSaving(false);
    }
  };

  return (
    <Modal title={schedule ? "Edit scheduled report" : "New scheduled report"} onClose={isSaving ? undefined : onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Name</span>
          <Input
            placeholder="Weekly fleet summary"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Report</span>
          <SelectInput value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)}>
            {REPORT_CATALOG.map((item) => (
              <option key={item.type} value={item.type}>
                {item.title}
              </option>
            ))}
          </SelectInput>
        </label>
        <ScheduleTimingFields timing={timing} timezone={timezone} onChange={setTiming} />
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClasses}>Recipients</span>
          <textarea
            value={recipientsText}
            onChange={(event) => setRecipientsText(event.target.value)}
            placeholder="ops@example.com, finance@example.com"
            rows={3}
            className="rounded-lg border border-borderGrayStrong bg-surface p-3 text-[15px] text-ink outline-none placeholder:text-mutedGray"
          />
          <span className="text-xs text-mutedGray">
            Email addresses, separated by commas. Up to {MAX_RECIPIENTS}. Each gets the CSV for the last 30 days.
          </span>
        </label>
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="ml-auto" disabled={!isComplete || isSaving}>
            {isSaving ? "Saving…" : schedule ? "Save changes" : "Create schedule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
