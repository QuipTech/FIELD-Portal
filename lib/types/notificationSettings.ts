export type AlertChannel = "push" | "email" | "sms";
export type TriggerParamValue = number | string | string[];
export type TriggerParams = Record<string, TriggerParamValue>;

export interface AlertRule {
  id: string;
  name: string;
  triggerType: string;
  triggerParams: TriggerParams;
  audiences: string[];
  channels: AlertChannel[];
  isEnabled: boolean;
  // How long before the rule may alert the same person about the same
  // machine or case again.
  cooldownMinutes: number;
  triggerLabel: string;
  notifyLabel: string;
  channelLabel: string;
  // Channels this rule uses that are switched off organisation-wide.
  disabledChannels: AlertChannel[];
  createdAt: string;
  updatedAt: string;
}

export type DeliveryChannels = Record<AlertChannel, boolean>;

export interface NotificationSettings {
  rules: AlertRule[];
  channels: DeliveryChannels;
}

export interface Option {
  value: string;
  label: string;
}

export type TriggerParamField =
  | { key: string; label: string; kind: "number"; unit: string; min: number; max: number; default: number }
  | { key: string; label: string; kind: "select"; options: Option[]; default: string }
  | { key: string; label: string; kind: "multiSelect"; options: Option[]; default: string[] };

// The catalog the "New rule" form is built from.
export interface NotificationOptions {
  triggerTypes: { type: string; label: string; fields: TriggerParamField[] }[];
  audiences: Option[];
  channels: { value: AlertChannel; label: string }[];
}

export interface AlertRulePayload {
  name: string;
  triggerType: string;
  triggerParams: TriggerParams;
  audiences: string[];
  channels: AlertChannel[];
  isEnabled: boolean;
  cooldownMinutes: number;
}

// What each channel did with a Send test; null when the caller couldn't
// be notified.
export type TestDeliveryChannel = "in_app" | AlertChannel;

export interface SendTestResult {
  userId: string;
  isNotified: boolean;
  deliveries: {
    channel: TestDeliveryChannel;
    result: { status: "sent" | "failed" | "skipped"; error?: string };
  }[];
}
