import { FleetMachine } from '../../machineFleet/types/machineFleetResponse';

export type CasePriority = 'P1' | 'P2' | 'P3';

export interface OpenCasesSummary {
  // Open or in progress.
  total: number;
  // Still open past their priority's response target (DashboardConfig).
  breachingSla: number;
  byPriority: Record<CasePriority, number>;
}

export interface MachinesDownSummary {
  total: number;
  // The most recently changed few, for the card's caption.
  machines: { id: string; label: string }[];
}

export interface EntriesThisWeekSummary {
  total: number;
  mine: number;
}

export interface UptimeWeek {
  // Monday (UTC) the week starts, as YYYY-MM-DD.
  weekStart: string;
  // null before tracking started or with no machines.
  uptimePercent: number | null;
}

export interface FleetUptime {
  // When the first status was recorded (migration 0053), or null.
  trackingSince: string | null;
  // Over every tracked machine-hour in the window.
  averagePercent: number | null;
  weeks: UptimeWeek[];
}

export type ActivityKind = 'case' | 'history_entry' | 'ai_thread' | 'knowledge';
export type ActivityTone = 'default' | 'primary' | 'amber' | 'danger' | 'ok';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  // Without the time; the portal adds "24 min ago".
  caption: string;
  occurredAt: string;
  href: string;
  tag: { label: string; tone: ActivityTone } | null;
}

export interface DashboardSummary {
  openCases: OpenCasesSummary;
  machinesDown: MachinesDownSummary;
  entriesThisWeek: EntriesThisWeekSummary;
  fleetUptime: FleetUptime;
  recentActivity: ActivityItem[];
  // Machines the caller has worked on, down / service due first.
  myMachines: FleetMachine[];
}
