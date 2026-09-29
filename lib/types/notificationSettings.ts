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
}
