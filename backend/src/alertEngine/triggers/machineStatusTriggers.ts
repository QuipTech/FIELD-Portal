import { DatabaseService } from '../../database/database.service';
import * as alertRulesRepository from '../alertRules.repository';
import { AlertMatch, AlertRuleToEvaluate } from '../types/alertTypes';

const toHours = (rule: AlertRuleToEvaluate) => Number(rule.triggerParams.hours);

const findMachinesInStatus = async (
  databaseService: DatabaseService,
  rule: AlertRuleToEvaluate,
  status: 'down' | 'service_due',
  describe: (label: string, hours: number) => string,
): Promise<AlertMatch[]> => {
  const hours = toHours(rule);
  const machines = await alertRulesRepository.findMachinesInStatus(
    databaseService,
    { tenantId: rule.tenantId, status, hours },
  );
  return machines.map((machine) => ({
    entityKey: `machine:${machine.machine_id}`,
    title: describe(machine.label, hours),
    body: machine.detail,
    link: `/machines/${machine.machine_id}/history`,
    machineId: machine.machine_id,
    caseId: null,
  }));
};

// "Machine down too long": status Down for more than `hours`.
export const findDownMachines = (
  databaseService: DatabaseService,
  rule: AlertRuleToEvaluate,
): Promise<AlertMatch[]> =>
  findMachinesInStatus(
    databaseService,
    rule,
    'down',
    (label, hours) => `${label} has been down for over ${hours} h`,
  );

// "Service overdue": in Service due status for more than `hours`. No
// service interval is stored, so time in that status stands for it.
export const findOverdueServices = (
  databaseService: DatabaseService,
  rule: AlertRuleToEvaluate,
): Promise<AlertMatch[]> =>
  findMachinesInStatus(
    databaseService,
    rule,
    'service_due',
    (label, hours) => `${label} has been due for service for over ${hours} h`,
  );
