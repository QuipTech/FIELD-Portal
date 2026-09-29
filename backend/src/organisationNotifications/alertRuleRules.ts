import { BadRequestException } from '@nestjs/common';
import {
  ALERT_AUDIENCES,
  ALERT_CHANNELS,
  AlertAudience,
  AlertChannel,
  findTriggerType,
  TriggerParamField,
  TriggerParams,
  TriggerParamValue,
} from './alertTriggerCatalog';
import { AlertRuleDto } from './dto/alertRuleDto';
import { AlertRuleRow, ChannelSettingsRow } from './types/notificationRows';
import { AlertRule, DeliveryChannels } from './types/notificationResponse';

const SMS_P1_ONLY_MESSAGE =
  'SMS is only for P1 cases: use it on a "P1 case unactioned" rule.';

// A missing value takes the field's default; anything else must fit the
// field. Returns the error, or the value to store.
const checkParam = (
  field: TriggerParamField,
  raw: unknown,
): { value: TriggerParamValue } | { error: string } => {
  if (raw === undefined || raw === null) return { value: field.default };
  const optionValues =
    field.kind === 'number' ? [] : field.options.map((option) => option.value);
  switch (field.kind) {
    case 'number':
      return typeof raw === 'number' &&
        Number.isFinite(raw) &&
        raw >= field.min &&
        raw <= field.max
        ? { value: raw }
        : {
            error: `${field.label} must be a number from ${field.min} to ${field.max}.`,
          };
    case 'select':
      return typeof raw === 'string' && optionValues.includes(raw)
        ? { value: raw }
        : {
            error: `${field.label} must be one of ${optionValues.join(', ')}.`,
          };
    case 'multiSelect': {
      const values = Array.isArray(raw) ? [...new Set(raw)] : [];
      return values.length &&
        values.every(
          (value) => typeof value === 'string' && optionValues.includes(value),
        )
        ? { value: values as string[] }
        : {
            error: `${field.label}: choose one or more of ${optionValues.join(', ')}.`,
          };
    }
  }
};

// Validates a rule against the trigger catalog and returns the params to
// store (defaults filled in, unknown keys dropped). Throws a 400 listing
// every problem.
export const validateAlertRule = (dto: AlertRuleDto): TriggerParams => {
  const triggerType = findTriggerType(dto.triggerType);
  if (!triggerType)
    throw new BadRequestException([
      `Unknown trigger type "${dto.triggerType}".`,
    ]);
  const problems: string[] = [];
  const params: TriggerParams = {};
  for (const field of triggerType.fields) {
    const checked = checkParam(field, dto.triggerParams?.[field.key]);
    if ('error' in checked) problems.push(checked.error);
    else params[field.key] = checked.value;
  }
  const isP1CaseRule =
    dto.triggerType === 'case_unactioned' && params.priority === 'P1';
  if (dto.channels.includes('sms') && !isP1CaseRule)
    problems.push(SMS_P1_ONLY_MESSAGE);
  if (problems.length) throw new BadRequestException(problems);
  return params;
};

const labelsFor = <T extends string>(
  values: string[],
  options: readonly { value: T; label: string }[],
) =>
  options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

export const toDeliveryChannels = (
  row: ChannelSettingsRow,
): DeliveryChannels => ({
  push: row.push_enabled,
  email: row.email_enabled,
  sms: row.sms_enabled,
});

export const toAlertRule = (
  row: AlertRuleRow,
  deliveryChannels: DeliveryChannels,
): AlertRule => {
  const params = row.trigger_params as TriggerParams;
  const channels = row.channels as AlertChannel[];
  return {
    id: row.id,
    name: row.name,
    triggerType: row.trigger_type,
    triggerParams: params,
    audiences: row.audiences as AlertAudience[],
    channels,
    isEnabled: row.is_enabled,
    triggerLabel:
      findTriggerType(row.trigger_type)?.describe(params) ?? row.trigger_type,
    notifyLabel: labelsFor(row.audiences, ALERT_AUDIENCES).join(' + ') || '—',
    channelLabel: labelsFor(channels, ALERT_CHANNELS).join(' · ') || '—',
    disabledChannels: channels.filter((channel) => !deliveryChannels[channel]),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
};
