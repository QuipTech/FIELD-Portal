// Every kind of alert rule an organisation can set up, the settings each
// takes, and how it reads in the table. The API validates rules against
// this, the portal builds its "New rule" form from it, and a future rule
// engine evaluates the same trigger_type/trigger_params.

export type TriggerParamValue = number | string | string[];
export type TriggerParams = Record<string, TriggerParamValue>;

export type TriggerParamField =
  | {
      key: string;
      label: string;
      kind: 'number';
      unit: string;
      min: number;
      max: number;
      default: number;
    }
  | {
      key: string;
      label: string;
      kind: 'select';
      options: { value: string; label: string }[];
      default: string;
    }
  | {
      key: string;
      label: string;
      kind: 'multiSelect';
      options: { value: string; label: string }[];
      default: string[];
    };

export interface AlertTriggerType {
  type: string;
  label: string;
  fields: TriggerParamField[];
  // How the rule's trigger reads, e.g. "Status = Down for > 4 h".
  describe: (params: TriggerParams) => string;
}

const FLAG_REASONS = [
  { value: 'low_confidence', label: 'Low confidence' },
  { value: 'safety_refusal', label: 'Safety refusal' },
  { value: 'no_source', label: 'No source found' },
  { value: 'marked_wrong', label: 'Marked wrong' },
];

const listLabels = (
  values: TriggerParamValue,
  options: { value: string; label: string }[],
) => {
  const labels = (Array.isArray(values) ? values : [])
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter(Boolean) as string[];
  return labels.length
    ? [labels[0], ...labels.slice(1).map((label) => label.toLowerCase())].join(
        ' or ',
      )
    : '—';
};

export const ALERT_TRIGGER_TYPES: AlertTriggerType[] = [
  {
    type: 'machine_down',
    label: 'Machine down too long',
    fields: [
      {
        key: 'hours',
        label: 'Down for more than',
        kind: 'number',
        unit: 'h',
        min: 1,
        max: 720,
        default: 4,
      },
    ],
    describe: (params) => `Status = Down for > ${params.hours} h`,
  },
  {
    type: 'service_overdue',
    label: 'Service overdue',
    fields: [
      {
        key: 'hours',
        label: 'Hours past due',
        kind: 'number',
        unit: 'h',
        min: 1,
        max: 10000,
        default: 100,
      },
    ],
    describe: (params) => `Hours past due > ${params.hours} h`,
  },
  {
    type: 'case_unactioned',
    label: 'Support case unactioned',
    fields: [
      {
        key: 'priority',
        label: 'Priority',
        kind: 'select',
        options: ['P1', 'P2', 'P3'].map((value) => ({ value, label: value })),
        default: 'P1',
      },
      {
        key: 'minutes',
        label: 'Open with no reply for',
        kind: 'number',
        unit: 'min',
        min: 5,
        max: 10080,
        default: 30,
      },
    ],
    describe: (params) =>
      `${params.priority} case open > ${params.minutes} min, no reply`,
  },
  {
    type: 'ai_answer_flagged',
    label: 'AI answer flagged',
    fields: [
      {
        key: 'reasons',
        label: 'Flagged for',
        kind: 'multiSelect',
        options: FLAG_REASONS,
        default: ['low_confidence', 'safety_refusal'],
      },
    ],
    describe: (params) => listLabels(params.reasons, FLAG_REASONS),
  },
  {
    type: 'uptime_drop',
    label: 'Fleet uptime drop',
    fields: [
      {
        key: 'percent',
        label: 'Site uptime below',
        kind: 'number',
        unit: '%',
        min: 1,
        max: 100,
        default: 85,
      },
      {
        key: 'period',
        label: 'Measured',
        kind: 'select',
        options: [
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
        ],
        default: 'weekly',
      },
    ],
    describe: (params) => `Site uptime < ${params.percent}% (${params.period})`,
  },
];

export const findTriggerType = (type: string): AlertTriggerType | undefined =>
  ALERT_TRIGGER_TYPES.find((triggerType) => triggerType.type === type);

// Who a rule notifies. Matched to people when sending is built.
export const ALERT_AUDIENCES = [
  { value: 'admins', label: 'Admins' },
  { value: 'site_supervisors', label: 'Site supervisor' },
  { value: 'assigned_technician', label: 'Assigned technician' },
  { value: 'ai_reviewers', label: 'AI reviewer group' },
] as const;
export type AlertAudience = (typeof ALERT_AUDIENCES)[number]['value'];

export const ALERT_CHANNELS = [
  { value: 'push', label: 'Push' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number]['value'];
