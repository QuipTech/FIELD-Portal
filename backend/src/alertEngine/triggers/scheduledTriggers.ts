import { DatabaseService } from '../../database/database.service';
import { AlertMatch, AlertRuleToEvaluate } from '../types/alertTypes';
import { findDownMachines, findOverdueServices } from './machineStatusTriggers';
import { findUnactionedCases } from './caseUnactionedTrigger';
import { findUptimeDrops } from './uptimeDropTrigger';

export type ScheduledTriggerType =
  'machine_down' | 'service_overdue' | 'case_unactioned' | 'uptime_drop';

type FindMatches = (
  databaseService: DatabaseService,
  rule: AlertRuleToEvaluate,
  now: Date,
) => Promise<AlertMatch[]>;

// The checks the schedule runs; "AI answer flagged" is event-based instead.
export const SCHEDULED_TRIGGERS: Record<ScheduledTriggerType, FindMatches> = {
  machine_down: findDownMachines,
  service_overdue: findOverdueServices,
  case_unactioned: findUnactionedCases,
  uptime_drop: findUptimeDrops,
};
