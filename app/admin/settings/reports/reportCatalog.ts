import type { IconName } from "@/components/icons/icon";
import type { ReportFrequency, ReportType, ScheduledReport } from "@/lib/types/adminReports";

export const REPORT_CATALOG: { type: ReportType; title: string; caption: string; icon: IconName }[] = [
  { type: "fleet_uptime", title: "Fleet uptime", caption: "By site, last 30 days", icon: "activity" },
  { type: "cases_sla", title: "Cases & SLA", caption: "Open + resolved, all sites", icon: "life" },
  { type: "ai_usage", title: "AI usage", caption: "Queries, cost, flags", icon: "spark" },
  { type: "audit_log", title: "Audit log", caption: "Admin & field actions, last 30 days", icon: "file" },
];

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const FREQUENCY_LABELS: Record<ReportFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const ordinal = (day: number) => {
  if (day % 10 === 1 && day !== 11) return `${day}st`;
  if (day % 10 === 2 && day !== 12) return `${day}nd`;
  if (day % 10 === 3 && day !== 13) return `${day}rd`;
  return `${day}th`;
};

export const formatSendHour = (hour: number) => {
  const suffix = hour < 12 ? "am" : "pm";
  return `${hour % 12 || 12}${suffix}`;
};

// "Every Monday, 6am", "1st of month, 8am", "Every day, 5pm".
export const describeSchedule = (schedule: Pick<ScheduledReport, "frequency" | "dayOfWeek" | "dayOfMonth" | "sendHour">) => {
  const time = formatSendHour(schedule.sendHour);
  if (schedule.frequency === "weekly") return `Every ${WEEKDAYS[(schedule.dayOfWeek ?? 1) - 1]}, ${time}`;
  if (schedule.frequency === "monthly") return `${ordinal(schedule.dayOfMonth ?? 1)} of month, ${time}`;
  return `Every day, ${time}`;
};
