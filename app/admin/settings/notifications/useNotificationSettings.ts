"use client";

import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import {
  createAlertRuleRequest,
  deleteAlertRuleRequest,
  getNotificationOptionsRequest,
  getNotificationSettingsRequest,
  replaceAlertRuleRequest,
  setAlertRuleEnabledRequest,
  updateChannelsRequest,
} from "@/lib/api/notificationSettingsApi";
import type { AlertChannel, AlertRule, AlertRulePayload } from "@/lib/types/notificationSettings";

// Each action rejects with the API's error so the calling control can
// show it; on success the settings are updated in place.
export const useNotificationSettings = () => {
  const settings = useApiResource(
    getNotificationSettingsRequest,
    [],
    "Couldn't load notification settings. Please try again.",
  );
  const options = useApiResource(getNotificationOptionsRequest, [], "Couldn't load the rule options.");

  const withRule = (rule: AlertRule, isNew: boolean) =>
    settings.setData((current) =>
      current
        ? {
            ...current,
            rules: isNew ? [...current.rules, rule] : current.rules.map((item) => (item.id === rule.id ? rule : item)),
          }
        : current,
    );

  return {
    settings: settings.data,
    options: options.data,
    isLoading: settings.isLoading,
    loadError: settings.error,
    saveRule: async (payload: AlertRulePayload, ruleId?: string) => {
      const token = requireAccessToken();
      const rule = ruleId
        ? await replaceAlertRuleRequest(token, ruleId, payload)
        : await createAlertRuleRequest(token, payload);
      withRule(rule, !ruleId);
    },
    setRuleEnabled: async (ruleId: string, isEnabled: boolean) => {
      withRule(await setAlertRuleEnabledRequest(requireAccessToken(), ruleId, isEnabled), false);
    },
    deleteRule: async (ruleId: string) => {
      await deleteAlertRuleRequest(requireAccessToken(), ruleId);
      settings.setData((current) =>
        current ? { ...current, rules: current.rules.filter((rule) => rule.id !== ruleId) } : current,
      );
    },
    // Rules are re-read too, since their "channel switched off" markers change.
    setChannel: async (channel: AlertChannel, isOn: boolean) => {
      settings.setData(await updateChannelsRequest(requireAccessToken(), { [channel]: isOn }));
    },
  };
};

export type NotificationSettingsState = ReturnType<typeof useNotificationSettings>;
