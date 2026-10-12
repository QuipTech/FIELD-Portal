// Mirrors backend/src/dashboard/types/dashboardResponse.ts.
import type { FleetMachine } from "./machineFleet";

export type CasePriority = "P1" | "P2" | "P3";
export type ActivityKind = "case" | "history_entry" | "ai_thread" | "knowledge";
export type ActivityTone = "default" | "primary" | "amber" | "danger" | "ok";

export interface UptimeWeek {
  // Monday (UTC), YYYY-MM-DD.
  weekStart: string;
  // null before tracking started.
  uptimePercent: number | null;
}

export interface FleetUptime {
  trackingSince: string | null;
  averagePercent: number | null;
  weeks: UptimeWeek[];
}

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  // Without the time, which the card adds.
  caption: string;
  occurredAt: string;
  href: string;
  tag: { label: string; tone: ActivityTone } | null;
}

export interface DashboardSummary {
  openCases: { total: number; breachingSla: number; byPriority: Record<CasePriority, number> };
  machinesDown: { total: number; machines: { id: string; label: string }[] };
  entriesThisWeek: { total: number; mine: number };
  fleetUptime: FleetUptime;
  recentActivity: ActivityItem[];
  // Machines the user has worked on, down / service due first.
  myMachines: FleetMachine[];
}
