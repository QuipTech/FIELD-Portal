"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { SavedToast } from "@/components/ui/savedToast";
import { SettingsRow } from "@/components/settings/settingsRow";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { deletePasskeyRequest, listPasskeysRequest, type Passkey } from "@/lib/api/passkeysApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { usePlatformAuthenticator } from "@/lib/auth/usePlatformAuthenticator";
import { registerThisDevice, toPasskeyErrorMessage } from "@/lib/auth/passkeys";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const describeUse = (passkey: Passkey) =>
  `Added ${formatDate(passkey.createdAt)} · ${
    passkey.lastUsedAt ? `last used ${formatDate(passkey.lastUsedAt)}` : "not used yet"
  }`;

// Settings → Face ID / Touch ID: set up this device, see and remove the
// devices that can sign in to this account.
export const PasskeySettingsSection = () => {
  const passkeys = useApiResource(listPasskeysRequest, [], "Couldn't load your devices.");
  const canUseBiometrics = usePlatformAuthenticator();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Passkey | null>(null);
  const devices = passkeys.data ?? [];

  const enrol = async () => {
    setError(null);
    setIsEnrolling(true);
    try {
      const saved = await registerThisDevice();
      setToast(`Face ID / Touch ID is set up on ${saved.deviceName}`);
      passkeys.reload();
    } catch (failure) {
      setError(toPasskeyErrorMessage(failure, "Couldn't set up Face ID / Touch ID. Please try again."));
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <>
      <h2 className="text-base font-medium text-ink">Face ID / Touch ID</h2>
      <div className="flex flex-col rounded-xl border border-borderGray bg-surface">
        <SettingsRow
          icon="faceid"
          tone="primary"
          title="Sign in with Face ID / Touch ID"
          caption={
            canUseBiometrics
              ? "Use this device's fingerprint or face to sign in, no password needed"
              : "This browser or device doesn't offer Face ID, Touch ID or Windows Hello"
          }
          bordered={devices.length > 0 || Boolean(error || passkeys.error)}
          trailing={
            canUseBiometrics && (
              <Button variant="primary" size="sm" disabled={isEnrolling} onClick={() => void enrol()}>
                {isEnrolling ? "Waiting for Face ID / Touch ID…" : "Set up on this device"}
              </Button>
            )
          }
        />
        {(error || passkeys.error) && (
          <p role="alert" className="border-b border-borderGray px-4 py-3 text-xs text-danger">
            {error || passkeys.error}
          </p>
        )}
        {devices.map((passkey, index) => (
          <SettingsRow
            key={passkey.id}
            icon="lock"
            title={passkey.deviceName}
            caption={describeUse(passkey)}
            bordered={index < devices.length - 1}
            trailing={
              <>
                {passkey.backedUp && <Tag tone="ok">Synced</Tag>}
                <Button size="sm" variant="danger" onClick={() => setRemoving(passkey)}>
                  Remove
                </Button>
              </>
            }
          />
        ))}
      </div>
      {removing && (
        <ConfirmDialog
          title="Remove Face ID / Touch ID?"
          confirmLabel="Remove"
          onConfirm={async () => {
            await deletePasskeyRequest(requireAccessToken(), removing.id);
            setToast(`Removed ${removing.deviceName}`);
            passkeys.reload();
          }}
          onClose={() => setRemoving(null)}
          toErrorMessage={(failure) => toApiErrorMessage(failure, "Couldn't remove this device.")}
        >
          {removing.deviceName} will no longer be able to sign in with Face ID / Touch ID. You can set it up again
          at any time.
        </ConfirmDialog>
      )}
      {toast && <SavedToast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
};
