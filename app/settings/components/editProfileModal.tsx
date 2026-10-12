"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PhoneNumberInput, type PhoneNumberValue } from "@/components/ui/phoneNumberInput";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { getProfileRequest } from "@/lib/api/accountApi";
import { AvatarUploader } from "@/components/uploads/avatarUploader";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { getInitials } from "@/lib/format/nameInitials";
import type { ProfileDetails } from "./profileDetails";
import { saveProfile, syncStoredProfile } from "./saveProfileChanges";

interface EditProfileModalProps {
  profile: ProfileDetails;
  onSave: (profile: ProfileDetails) => void;
  // The photo is saved on upload, so the page shows it even if the rest
  // of the form is cancelled.
  onAvatarUploaded: (avatarUrl: string | undefined) => void;
  onClose: () => void;
}

const SAVE_FAILED_MESSAGE = "Couldn't save your profile. Please try again.";

// The photo uploads (and is saved) as soon as it's picked; the name and
// mobile number are saved with "Save changes".
export const EditProfileModal = ({ profile, onSave, onAvatarUploaded, onClose }: EditProfileModalProps) => {
  const [draft, setDraft] = useState<ProfileDetails>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedProfile = useApiResource(getProfileRequest, [], "Couldn't load your mobile number.");
  // null until the number is edited, so an untouched number is left as is.
  const [phone, setPhone] = useState<PhoneNumberValue | null>(null);
  const isPhoneInvalid = phone !== null && !phone.isEmpty && !phone.isValid;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const phoneNumber = phone === null ? undefined : phone.isEmpty ? null : phone.e164;
      const saved = await saveProfile(draft.name, phoneNumber);
      onSave({ ...draft, name: `${saved.firstName} ${saved.lastName}`.trim(), avatarUrl: saved.avatarUrl ?? undefined });
    } catch (error) {
      setSaveError(toApiErrorMessage(error, SAVE_FAILED_MESSAGE));
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Edit profile" onClose={isSaving ? undefined : onClose}>
      <div className="flex flex-col gap-3.5 p-5">
        <AvatarUploader
          initials={getInitials(draft.name)}
          avatarUrl={draft.avatarUrl}
          onUploaded={(saved) => {
            syncStoredProfile(saved);
            setDraft((current) => ({ ...current, avatarUrl: saved.avatarUrl ?? undefined }));
            onAvatarUploaded(saved.avatarUrl ?? undefined);
          }}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Full name</span>
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Work email</span>
          {/* The sign-in identity — changing it needs verification, not a text field. */}
          <Input icon="user" type="email" value={draft.email} readOnly disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Role</span>
          {/* Assigned by an admin on the Users page, not editable here. */}
          <Input value={draft.role} readOnly disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Mobile number</span>
          {savedProfile.data ? (
            <PhoneNumberInput initialE164={savedProfile.data.phoneNumber} onChange={setPhone} />
          ) : (
            <span className="text-xs text-mutedGray">{savedProfile.error ?? "Loading…"}</span>
          )}
          <span className={`text-xs ${isPhoneInvalid ? "text-danger" : "text-mutedGray"}`}>
            {isPhoneInvalid ? "That number isn't valid for the chosen country." : "Used for urgent (P1) alert texts."}
          </span>
        </div>
        {saveError && <span className="text-xs text-danger">{saveError}</span>}
        <div className="flex">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" className="ml-auto" onClick={handleSave} disabled={isSaving || !draft.name.trim() || isPhoneInvalid}>
            <Icon name="check" />
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
