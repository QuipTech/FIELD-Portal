import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AuditEntry, runAuditedChange } from '../common/audit/runAuditedChange';
import * as notificationsRepository from './notifications.repository';
import {
  toAlertRule,
  toDeliveryChannels,
  validateAlertRule,
} from './alertRuleRules';
import { ensureNotificationDefaults } from './notificationSettings.service';
import { NewAlertRule } from './defaultAlertRules';
import { AlertRuleDto } from './dto/alertRuleDto';
import { AlertRuleRow } from './types/notificationRows';
import { AlertRule } from './types/notificationResponse';

const RULE_NOT_FOUND_MESSAGE = 'Alert rule not found.';
const DUPLICATE_NAME_MESSAGE = 'An alert rule with that name already exists.';

const toNewRule = (dto: AlertRuleDto): NewAlertRule => ({
  name: dto.name,
  triggerType: dto.triggerType,
  triggerParams: validateAlertRule(dto),
  audiences: dto.audiences,
  channels: dto.channels,
  isEnabled: dto.isEnabled,
});

// Creating, editing, switching and deleting the organisation's alert
// rules. Owner only (see the controller); each change is audited.
@Injectable()
export class AlertRulesService {
  constructor(private readonly databaseService: DatabaseService) {}

  // async (like replaceRule) so a validation failure is a rejected
  // promise rather than a synchronous throw.
  createRule = async (
    actor: AuthenticatedUser,
    dto: AlertRuleDto,
  ): Promise<AlertRule> => {
    const rule = toNewRule(dto);
    return this.changeRule(actor, 'create', (client) =>
      notificationsRepository.insertAlertRule(client, {
        tenantId: actor.tenantId,
        createdBy: actor.userId,
        rule,
      }),
    );
  };

  replaceRule = async (
    actor: AuthenticatedUser,
    ruleId: string,
    dto: AlertRuleDto,
  ): Promise<AlertRule> => {
    const rule = toNewRule(dto);
    return this.changeRule(actor, 'update', (client) =>
      notificationsRepository.replaceAlertRule(client, {
        tenantId: actor.tenantId,
        ruleId,
        rule,
      }),
    );
  };

  setRuleEnabled = (
    actor: AuthenticatedUser,
    ruleId: string,
    isEnabled: boolean,
  ): Promise<AlertRule> =>
    this.changeRule(actor, 'update', (client) =>
      notificationsRepository.setAlertRuleEnabled(client, {
        tenantId: actor.tenantId,
        ruleId,
        isEnabled,
      }),
    );

  deleteRule = async (
    actor: AuthenticatedUser,
    ruleId: string,
  ): Promise<void> => {
    await this.changeRule(actor, 'delete', (client) =>
      notificationsRepository.softDeleteAlertRule(client, {
        tenantId: actor.tenantId,
        ruleId,
      }),
    );
  };

  // Applies one change inside the audited transaction; `apply` resolves to
  // the changed row, or undefined when the rule isn't this organisation's.
  private changeRule = (
    actor: AuthenticatedUser,
    action: AuditEntry['action'],
    apply: (client: PoolClient) => Promise<AlertRuleRow | undefined>,
  ): Promise<AlertRule> =>
    runAuditedChange(
      this.databaseService,
      actor,
      DUPLICATE_NAME_MESSAGE,
      async (client) => {
        await ensureNotificationDefaults(client, actor);
        const row = await apply(client);
        if (!row) throw new NotFoundException(RULE_NOT_FOUND_MESSAGE);
        const channels = toDeliveryChannels(
          await notificationsRepository.findChannelSettings(
            client,
            actor.tenantId,
          ),
        );
        const rule = toAlertRule(row, channels);
        const metadata = {
          name: rule.name,
          triggerType: rule.triggerType,
          triggerParams: rule.triggerParams,
          audiences: rule.audiences,
          channels: rule.channels,
          isEnabled: rule.isEnabled,
        };
        return {
          result: rule,
          audit: {
            action,
            entityType: 'alert_rule',
            entityId: rule.id,
            metadata,
          },
        };
      },
    );
}
