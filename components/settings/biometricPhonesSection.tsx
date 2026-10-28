"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { SavedToast } from "@/components/ui/savedToast";
import { SettingsRow } from "@/components/settings/settingsRow";
import { useApiResource } from "@/lib/hooks/useApiResource";
import {
  deleteBiometricPhoneRequest,
  listBiometricPhonesRequest,
  type BiometricPhone,
} from "@/lib/api/biometricKeysApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";

const PHONE_NAMES: Record<BiometricPhone["deviceType"], string> = { ios: "iPhone", android: "Android phone" };

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const describePhone = (phone: BiometricPhone) =>
  `${phone.appVersion ? `App ${phone.appVersion} · ` : ""}Added ${formatDate(phone.createdAt)} · ${
    phone.lastUsedAt ? `last used ${formatDate(phone.lastUsedAt)}` : "not used yet"
  }`;

// Settings → the phones that can sign in with fingerprint / Face ID in the
// FIELD mobile app. Removing one is how a lost phone is locked out.
export const BiometricPhonesSection = () => {
  const phones = useApiResource(listBiometricPhonesRequest, [], "Couldn't load your phones.");
  const [toast, setToast] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BiometricPhone | null>(null);
  const list = phones.data ?? [];

  return (
    <>
      <h2 className="text-base font-medium text-ink">Mobile app fingerprint / Face ID</h2>
      <div className="flex flex-col rounded-xl border border-borderGray bg-surface">
        {phones.error && (
          <p role="alert" className="border-b border-borderGray px-4 py-3 text-xs text-danger">
            {phones.error}
          </p>
        )}
        {list.length === 0 && (
          <SettingsRow
            icon="faceid"
            title="No phones set up"
            caption="Turn it on in the FIELD app under Me → Security"
            bordered={false}
          />
        )}
        {list.map((phone, index) => (
          <SettingsRow
            key={phone.id}
            icon="lock"
            title={PHONE_NAMES[phone.deviceType]}
            caption={describePhone(phone)}
            bordered={index < list.length - 1}
            trailing={
              <Button size="sm" variant="danger" onClick={() => setRemoving(phone)}>
                Remove
              </Button>
            }
          />
        ))}
      </div>
      {removing && (
        <ConfirmDialog
          title="Remove fingerprint / Face ID sign-in?"
          confirmLabel="Remove"
          onConfirm={async () => {
            await deleteBiometricPhoneRequest(requireAccessToken(), removing.id);
            setToast(`Removed ${PHONE_NAMES[removing.deviceType]}`);
            phones.reload();
          }}
          onClose={() => setRemoving(null)}
          toErrorMessage={(failure) => toApiErrorMessage(failure, "Couldn't remove this phone.")}
        >
          This {PHONE_NAMES[removing.deviceType]} will no longer be able to sign in with fingerprint or Face ID. It can
          still sign in another way and turn it on again.
        </ConfirmDialog>
      )}
      {toast && <SavedToast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
};
