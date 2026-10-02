import { DatabaseService } from '../../database/database.service';
import * as alertRulesRepository from '../alertRules.repository';
import { AlertMatch, AlertRuleToEvaluate } from '../types/alertTypes';

// "Support case unactioned": open cases of the rule's priority with no
// reply from anyone but the reporter after `minutes`.
export const findUnactionedCases = async (
  databaseService: DatabaseService,
  rule: AlertRuleToEvaluate,
): Promise<AlertMatch[]> => {
  const priority = String(rule.triggerParams.priority);
  const minutes = Number(rule.triggerParams.minutes);
  const cases = await alertRulesRepository.findUnactionedCases(
    databaseService,
    { tenantId: rule.tenantId, priority, minutes },
  );
  return cases.map((supportCase) => ({
    entityKey: `case:${supportCase.case_id}`,
    title: `${priority} case #${supportCase.case_number} has no reply after ${minutes} min`,
    body: [supportCase.subject, supportCase.site].filter(Boolean).join(' · '),
    link: `/cases/${supportCase.case_number}`,
    machineId: null,
    caseId: supportCase.case_id,
  }));
};
