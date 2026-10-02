"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { AlertChannel, AlertRule } from "@/lib/types/notificationSettings";
import { useNotificationSettings } from "../useNotificationSettings";
import { describeTestResult } from "../describeTestResult";
import { AlertRulesTable } from "./alertRulesTable";
import { DeliveryChannelsGrid } from "./deliveryChannelsGrid";
import { AlertRuleModal } from "./alertRuleModal";

type RuleDialog = { kind: "edit"; rule?: AlertRule } | { kind: "delete"; rule: AlertRule };

export const NotificationSettingsManager = () => {
  const notifications = useNotificationSettings();
  const [dialog, setDialog] = useState<RuleDialog | null>(null);
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);
  const [pendingChannel, setPendingChannel] = useState<AlertChannel | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [testNote, setTestNote] = useState<{ text: string; isError: boolean } | null>(null);
  const { settings, options } = notifications;

  // Switch changes save straight away; a failure is shown above the table.
  const runSwitch = async (markPending: () => void, clearPending: () => void, change: () => Promise<void>) => {
    markPending();
    setActionError(null);
    try {
      await change();
    } catch (error) {
      setActionError(toApiErrorMessage(error, "Couldn't save that change. Please try again."));
    } finally {
      clearPending();
    }
  };

  const sendTest = async (rule: AlertRule) => {
    setTestNote({ text: `Sending a test of "${rule.name}"…`, isError: false });
    try {
      setTestNote(describeTestResult(await notifications.sendTest(rule.id)));
    } catch (error) {
      setTestNote({ text: toApiErrorMessage(error, "Couldn't send the test. Please try again."), isError: true });
    }
  };

  return (
    <>
      <div className="flex items-center">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Settings · Notifications</span>
          <h1 className="text-xl font-bold text-slate-900">Notifications &amp; alert rules</h1>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: "edit" })}
          disabled={!settings || !options}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-[#4F39F6] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4330db] disabled:opacity-50"
        >
          <Icon name="plus" className="h-4 w-4" />
          New rule
        </button>
      </div>
      {notifications.isLoading && !settings && (
        <span className="flex items-center gap-2 p-10 text-sm text-mutedGray">
          <LoadingSpinner /> Loading notification settings…
        </span>
      )}
      {notifications.loadError && <span className="text-sm text-danger">{notifications.loadError}</span>}
      {actionError && <span className="text-xs text-danger">{actionError}</span>}
      {testNote && <span className={`text-xs ${testNote.isError ? "text-danger" : "text-mutedGray"}`}>{testNote.text}</span>}
      {settings && (
        <>
          <div>
            <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-800">Alert rules</h2>
            <AlertRulesTable
              rules={settings.rules}
              pendingRuleId={pendingRuleId}
              onToggle={(rule) =>
                runSwitch(
                  () => setPendingRuleId(rule.id),
                  () => setPendingRuleId(null),
                  () => notifications.setRuleEnabled(rule.id, !rule.isEnabled),
                )
              }
              onEdit={(rule) => setDialog({ kind: "edit", rule })}
              onSendTest={sendTest}
              onDelete={(rule) => setDialog({ kind: "delete", rule })}
            />
          </div>
          <div>
            <h2 className="mb-4 mt-8 text-lg font-semibold text-slate-900">Delivery channels</h2>
            <DeliveryChannelsGrid
              values={settings.channels}
              pendingChannel={pendingChannel}
              onToggle={(channel, isOn) =>
                runSwitch(
                  () => setPendingChannel(channel),
                  () => setPendingChannel(null),
                  () => notifications.setChannel(channel, isOn),
                )
              }
            />
          </div>
        </>
      )}
      {dialog?.kind === "edit" && options && (
        <AlertRuleModal
          options={options}
          rule={dialog.rule}
          onSave={notifications.saveRule}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title="Delete alert rule"
          confirmLabel="Delete rule"
          onConfirm={() => notifications.deleteRule(dialog.rule.id)}
          onClose={() => setDialog(null)}
          toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't delete the rule. Please try again.")}
        >
          Delete <strong>{dialog.rule.name}</strong>? Nobody will be alerted for it any more.
        </ConfirmDialog>
      )}
    </>
  );
};
