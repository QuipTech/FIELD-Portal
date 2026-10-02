import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { getPortalOrigins } from '../common/security/portalOrigins';
import * as alertDeliveryRepository from './alertDelivery.repository';
import { toRecipientCandidate } from './alertMappers';
import { resolveRecipients } from './resolveRecipients';
import { filterChannels } from './filterChannels';
import { EmailChannel } from './channels/emailChannel';
import { SmsChannel } from './channels/smsChannel';
import { PushChannel } from './channels/pushChannel';
import { NotificationChannel } from './channels/notificationChannel';
import {
  AlertMatch,
  AlertMessage,
  AlertRuleToEvaluate,
  DeliveryResult,
  RecipientCandidate,
  RecipientDelivery,
} from './types/alertTypes';

export interface DispatchOptions {
  // Send to this user only (Send test), still within the rule's
  // organisation.
  onlyUserId?: string;
}

// Turns one rule match into notifications: resolves the recipients inside
// the rule's organisation, writes each in-app notification (skipping
// anyone still in the cooldown) and delivers it on the allowed channels,
// recording every outcome.
@Injectable()
export class AlertDispatcherService {
  private readonly logger = new Logger(AlertDispatcherService.name);
  private readonly channels: NotificationChannel[];

  constructor(
    private readonly databaseService: DatabaseService,
    emailChannel: EmailChannel,
    smsChannel: SmsChannel,
    pushChannel: PushChannel,
  ) {
    this.channels = [pushChannel, emailChannel, smsChannel];
  }

  dispatch = async (
    rule: AlertRuleToEvaluate,
    match: AlertMatch,
    options: DispatchOptions = {},
  ): Promise<RecipientDelivery[]> => {
    const recipients = await this.findRecipients(rule, match, options);
    if (!recipients.length) {
      this.logger.log(
        `Rule ${rule.id} matched ${match.entityKey}: nobody to notify`,
      );
      return [];
    }
    const message = await this.buildMessage(rule, match);
    const results: RecipientDelivery[] = [];
    for (const recipient of recipients) {
      results.push(await this.notifyRecipient(rule, match, recipient, message));
    }
    return results;
  };

  private findRecipients = async (
    rule: AlertRuleToEvaluate,
    match: AlertMatch,
    options: DispatchOptions,
  ): Promise<RecipientCandidate[]> => {
    const rows = await alertDeliveryRepository.listRecipientCandidates(
      this.databaseService,
      {
        tenantId: rule.tenantId,
        machineId: match.machineId,
        caseId: match.caseId,
      },
    );
    const candidates = rows.map(toRecipientCandidate);
    if (!options.onlyUserId)
      return resolveRecipients(rule.audiences, candidates, rule.tenantId);
    return candidates.filter(
      (candidate) =>
        candidate.userId === options.onlyUserId &&
        candidate.tenantId === rule.tenantId,
    );
  };

  private notifyRecipient = async (
    rule: AlertRuleToEvaluate,
    match: AlertMatch,
    recipient: RecipientCandidate,
    message: AlertMessage,
  ): Promise<RecipientDelivery> => {
    const notificationId = await alertDeliveryRepository.recordNotification(
      this.databaseService,
      {
        tenantId: rule.tenantId,
        userId: recipient.userId,
        ruleId: rule.id,
        entityKey: match.entityKey,
        cooldownMinutes: rule.cooldownMinutes,
        title: match.title,
        body: match.body,
        link: match.link,
      },
    );
    if (!notificationId)
      return { userId: recipient.userId, isNotified: false, deliveries: [] };
    const deliveries: RecipientDelivery['deliveries'] = [
      { channel: 'in_app', result: { status: 'sent' } },
    ];
    const allowed = filterChannels(rule);
    for (const channel of this.channels) {
      if (!allowed.includes(channel.channel)) continue;
      const result = await this.deliverSafely(channel, recipient, message);
      if (result.status === 'skipped')
        this.logger.log(
          `Skipped ${channel.channel} for user ${recipient.userId}: ${result.error}`,
        );
      deliveries.push({ channel: channel.channel, result });
    }
    for (const delivery of deliveries) {
      await alertDeliveryRepository.recordDelivery(this.databaseService, {
        notificationId,
        ...delivery,
      });
    }
    return { userId: recipient.userId, isNotified: true, deliveries };
  };

  private deliverSafely = async (
    channel: NotificationChannel,
    recipient: RecipientCandidate,
    message: AlertMessage,
  ): Promise<DeliveryResult> => {
    try {
      return await channel.deliver(recipient, message);
    } catch (error) {
      this.logger.warn(
        `${channel.channel} to user ${recipient.userId} failed: ${String(error)}`,
      );
      return { status: 'failed', error: String(error) };
    }
  };

  private buildMessage = async (
    rule: AlertRuleToEvaluate,
    match: AlertMatch,
  ): Promise<AlertMessage> => {
    const branding = await alertDeliveryRepository.findTenantBranding(
      this.databaseService,
      rule.tenantId,
    );
    return {
      title: match.title,
      body: match.body,
      url: `${getPortalOrigins()[0]}${match.link}`,
      ruleName: rule.name,
      organisationName: branding?.name ?? 'Your organisation',
      accentColor:
        branding?.branding_color_accent ??
        branding?.branding_color_primary ??
        null,
    };
  };
}
