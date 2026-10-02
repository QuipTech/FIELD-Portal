import { apiRequest } from "./httpClient";
import type {
  AlertRule,
  AlertRulePayload,
  DeliveryChannels,
  NotificationOptions,
  NotificationSettings,
  SendTestResult,
} from "../types/notificationSettings";

// The signed-in admin's own organisation. Owner role only. The server's
// rule engine evaluates and sends the saved rules.
const authorizationHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

const sendJson = <T>(accessToken: string, path: string, method: string, body?: unknown) =>
  apiRequest<T>(path, {
    method,
    headers: authorizationHeader(accessToken),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const getNotificationSettingsRequest = (accessToken: string) =>
  apiRequest<NotificationSettings>("/organisation/notifications", { headers: authorizationHeader(accessToken) });

export const getNotificationOptionsRequest = (accessToken: string) =>
  apiRequest<NotificationOptions>("/organisation/notifications/options", { headers: authorizationHeader(accessToken) });

export const updateChannelsRequest = (accessToken: string, channels: Partial<DeliveryChannels>) =>
  sendJson<NotificationSettings>(accessToken, "/organisation/notifications/channels", "PATCH", channels);

export const createAlertRuleRequest = (accessToken: string, payload: AlertRulePayload) =>
  sendJson<AlertRule>(accessToken, "/organisation/notifications/rules", "POST", payload);

export const replaceAlertRuleRequest = (accessToken: string, ruleId: string, payload: AlertRulePayload) =>
  sendJson<AlertRule>(accessToken, `/organisation/notifications/rules/${ruleId}`, "PUT", payload);

export const setAlertRuleEnabledRequest = (accessToken: string, ruleId: string, isEnabled: boolean) =>
  sendJson<AlertRule>(accessToken, `/organisation/notifications/rules/${ruleId}`, "PATCH", { isEnabled });

export const deleteAlertRuleRequest = (accessToken: string, ruleId: string) =>
  sendJson<void>(accessToken, `/organisation/notifications/rules/${ruleId}`, "DELETE");

// A sample alert to the caller only, on the rule's channels.
export const sendTestAlertRequest = (accessToken: string, ruleId: string) =>
  sendJson<SendTestResult | null>(accessToken, `/organisation/notifications/rules/${ruleId}/test`, "POST");
