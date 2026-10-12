import { DatabaseService } from '../../database/database.service';
import * as alertRulesRepository from '../alertRules.repository';
import { AlertMatch, AlertRuleToEvaluate } from '../types/alertTypes';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<string, number> = { weekly: 7, monthly: 30 };

// "Fleet uptime drop": sites whose uptime over the rule's period is below
// `percent`. Sites with no tracked time are left out.
export const findUptimeDrops = async (
  databaseService: DatabaseService,
  rule: AlertRuleToEvaluate,
  now: Date,
): Promise<AlertMatch[]> => {
  const period = String(rule.triggerParams.period);
  const threshold = Number(rule.triggerParams.percent);
  const since = new Date(now.getTime() - (PERIOD_DAYS[period] ?? 7) * DAY_MS);
  const sites = await alertRulesRepository.listSiteUptime(databaseService, {
    tenantId: rule.tenantId,
    since,
  });
  return sites.flatMap((site) => {
    const tracked = Number(site.tracked_hours);
    if (tracked <= 0) return [];
    const uptime = ((tracked - Number(site.down_hours)) / tracked) * 100;
    if (uptime >= threshold) return [];
    return [
      {
        entityKey: `site:${site.site}:${period}`,
        title: `${site.site} uptime fell to ${uptime.toFixed(1)}% (${period})`,
        body: `Below the ${threshold}% target across ${site.machine_count} machines.`,
        link: '/machines',
        machineId: null,
        caseId: null,
      },
    ];
  });
};
