import type { ConfigurationSnapshot, ConfigurationDiffRow } from "@/lib/types/configurationDiff";

export const configurationSnapshots: ConfigurationSnapshot[] = [
  { id: "snap-1", dateLabel: "18 Mar · 14:20", takenBy: "J. Okoye", trigger: "Manual" },
  { id: "snap-2", dateLabel: "12 Mar · 09:05", takenBy: "System", trigger: "Component replaced" },
  { id: "snap-3", dateLabel: "06 Mar · 22:00", takenBy: "System", trigger: "Scheduled" },
  { id: "snap-4", dateLabel: "27 Feb · 11:40", takenBy: "A. Silva", trigger: "Service" },
  { id: "snap-5", dateLabel: "14 Feb · 22:00", takenBy: "System", trigger: "Scheduled" },
  { id: "snap-6", dateLabel: "02 Feb · 16:12", takenBy: "R. Mbeki", trigger: "Component replaced" },
];

export const configurationDiffRows: ConfigurationDiffRow[] = [
  { kind: "Changed", component: "Hydraulic pump — main", before: "Pump A · P/N 4T-9231", after: "Pump B · P/N 4T-9455" },
  { kind: "Changed", component: "ECM firmware", before: "v4.12.3", after: "v4.14.0" },
  { kind: "Added", component: "Aftercooler temp sensor", before: "—", after: "S/N 88-2041 · fitted 12 Mar" },
  { kind: "Removed", component: "Auxiliary hydraulic filter kit", before: "Kit 1R-0762", after: "—" },
];
