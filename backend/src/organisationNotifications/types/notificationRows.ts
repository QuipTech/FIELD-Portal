export interface AlertRuleRow {
  id: string;
  name: string;
  trigger_type: string;
  trigger_params: Record<string, unknown>;
  audiences: string[];
  channels: string[];
  is_enabled: boolean;
  cooldown_minutes: number;
  created_at: Date;
  updated_at: Date;
}

export interface ChannelSettingsRow {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
}
