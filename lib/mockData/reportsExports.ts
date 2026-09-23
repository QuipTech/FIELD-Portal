import type { IconName } from "@/components/icons/icon";

export interface QuickExport {
  id: string;
  title: string;
  caption: string;
  icon: IconName;
}

export const quickExports: QuickExport[] = [
  { id: "fleet-uptime", title: "Fleet uptime", caption: "By site, last 30 days", icon: "activity" },
  { id: "cases-sla", title: "Cases & SLA", caption: "Open + resolved, all sites", icon: "life" },
  { id: "ai-usage", title: "AI usage", caption: "Queries, cost, flags", icon: "spark" },
  { id: "audit-log", title: "Audit log", caption: "All admin & field actions", icon: "file" },
];

export type ReportFormat = "PDF" | "CSV";

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: string;
  recipients: string;
  format: ReportFormat;
  lastSentLabel: string;
}

export const scheduledReports: ScheduledReport[] = [
  {
    id: "weekly-fleet",
    name: "Weekly fleet summary",
    frequency: "Every Monday, 6am",
    recipients: "3 site supervisors",
    format: "PDF",
    lastSentLabel: "17 Mar",
  },
  {
    id: "monthly-exec",
    name: "Monthly executive report",
    frequency: "1st of month, 8am",
    recipients: "Ops director",
    format: "PDF",
    lastSentLabel: "1 Mar",
  },
  {
    id: "ai-usage-cost",
    name: "AI usage & cost",
    frequency: "Every Friday, 5pm",
    recipients: "A. Kaur, finance",
    format: "CSV",
    lastSentLabel: "14 Mar",
  },
];
