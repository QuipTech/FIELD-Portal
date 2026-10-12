import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { findTriggerType } from '../organisationNotifications/alertTriggerCatalog';
import * as alertRulesRepository from './alertRules.repository';
import { toRuleToEvaluate } from './alertMappers';
import { AlertDispatcherService } from './alertDispatcher.service';
import {
  SCHEDULED_TRIGGERS,
  ScheduledTriggerType,
} from './triggers/scheduledTriggers';
import {
  AnswerFlaggedEvent,
  ruleWatchesReason,
  toAnswerFlaggedMatch,
} from './triggers/answerFlaggedTrigger';
import { AlertRuleToEvaluate, RecipientDelivery } from './types/alertTypes';

const RULE_NOT_FOUND_MESSAGE = 'Alert rule not found.';

// Evaluates the organisations' switched-on alert rules: the scheduled
// checks (AlertScheduleService), the "AI answer flagged" event and Send
// test. Every rule is evaluated inside its own organisation; one failing
// rule never stops the others.
@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dispatcher: AlertDispatcherService,
  ) {}

  // `appliesTo` narrows the rules, e.g. uptime rules of one period.
  runScheduledCheck = async (
    triggerType: ScheduledTriggerType,
    appliesTo: (rule: AlertRuleToEvaluate) => boolean = () => true,
  ): Promise<void> => {
    const rows = await alertRulesRepository.listEnabledRules(
      this.databaseService,
      [triggerType],
      null,
    );
    const now = new Date();
    for (const rule of rows.map(toRuleToEvaluate).filter(appliesTo)) {
      try {
        const matches = await SCHEDULED_TRIGGERS[triggerType](
          this.databaseService,
          rule,
          now,
        );
        for (const match of matches)
          await this.dispatcher.dispatch(rule, match);
      } catch (error) {
        this.logger.error(`Alert rule ${rule.id} failed: ${String(error)}`);
      }
    }
  };

  // Called by the AI assistant after an answer goes to the review queue.
  // Never throws: the technician's answer is already saved.
  handleAnswerFlagged = async (event: AnswerFlaggedEvent): Promise<void> => {
    try {
      const rows = await alertRulesRepository.listEnabledRules(
        this.databaseService,
        ['ai_answer_flagged'],
        event.tenantId,
      );
      const match = toAnswerFlaggedMatch(event);
      for (const rule of rows.map(toRuleToEvaluate)) {
        if (ruleWatchesReason(rule.triggerParams.reasons, event.reasonCode))
          await this.dispatcher.dispatch(rule, match);
      }
    } catch (error) {
      this.logger.error(`Flagged-answer alerts failed: ${String(error)}`);
    }
  };

  // A sample alert to the admin who asked, on the rule's channels (those
  // switched on for the organisation), ignoring the cooldown.
  sendTest = async (
    actor: AuthenticatedUser,
    ruleId: string,
  ): Promise<RecipientDelivery | null> => {
    const row = await alertRulesRepository.findRule(
      this.databaseService,
      actor.tenantId,
      ruleId,
    );
    if (!row) throw new NotFoundException(RULE_NOT_FOUND_MESSAGE);
    const rule = { ...toRuleToEvaluate(row), cooldownMinutes: 0 };
    const trigger = findTriggerType(rule.triggerType);
    const [delivery] = await this.dispatcher.dispatch(
      rule,
      {
        entityKey: `test:${Date.now()}`,
        title: `Test alert: ${rule.name}`,
        body: `This is how "${trigger?.describe(rule.triggerParams) ?? rule.name}" alerts will look.`,
        link: '/admin/settings/notifications',
        machineId: null,
        caseId: null,
      },
      { onlyUserId: actor.userId },
    );
    return delivery ?? null;
  };
}
