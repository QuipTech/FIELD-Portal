import { DatabaseService } from '../database/database.service';
import {
  AlertRuleRow,
  MachineInStatusRow,
  UnactionedCaseRow,
} from './types/alertRows';
import { FleetUptimeRow } from '../adminReports/types/reportRows';

// Reads for the rule engine, through the SECURITY DEFINER functions of
// migrations 0064/0065 (the engine runs outside any request). Each takes
// the organisation and filters on it.

// tenantId null: every organisation (the scheduled checks).
export const listEnabledRules = async (
  databaseService: DatabaseService,
  triggerTypes: string[],
  tenantId: string | null,
): Promise<AlertRuleRow[]> => {
  const result = await databaseService.query<AlertRuleRow>(
    `SELECT * FROM alert_list_enabled_rules($1, $2)`,
    [triggerTypes, tenantId],
  );
  return result.rows;
};

export const findRule = async (
  databaseService: DatabaseService,
  tenantId: string,
  ruleId: string,
): Promise<AlertRuleRow | undefined> => {
  const result = await databaseService.query<AlertRuleRow>(
    `SELECT * FROM alert_find_rule($1, $2)`,
    [tenantId, ruleId],
  );
  return result.rows[0];
};

export const findMachinesInStatus = async (
  databaseService: DatabaseService,
  params: { tenantId: string; status: 'down' | 'service_due'; hours: number },
): Promise<MachineInStatusRow[]> => {
  const result = await databaseService.query<MachineInStatusRow>(
    `SELECT * FROM alert_find_machines_in_status($1, $2, $3)`,
    [params.tenantId, params.status, params.hours],
  );
  return result.rows;
};

export const findUnactionedCases = async (
  databaseService: DatabaseService,
  params: { tenantId: string; priority: string; minutes: number },
): Promise<UnactionedCaseRow[]> => {
  const result = await databaseService.query<UnactionedCaseRow>(
    `SELECT * FROM alert_find_unactioned_cases($1, $2, $3)`,
    [params.tenantId, params.priority, params.minutes],
  );
  return result.rows;
};

// Same figures as the Fleet uptime report (migration 0064).
export const listSiteUptime = async (
  databaseService: DatabaseService,
  params: { tenantId: string; since: Date },
): Promise<FleetUptimeRow[]> => {
  const result = await databaseService.query<FleetUptimeRow>(
    `SELECT * FROM admin_report_fleet_uptime($1, $2)`,
    [params.tenantId, params.since],
  );
  return result.rows;
};
