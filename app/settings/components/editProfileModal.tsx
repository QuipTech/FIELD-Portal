"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInitials, type ProfileDetails } from "./profileDetails";

interface EditProfileModalProps {
  profile: ProfileDetails;
  onSave: (profile: ProfileDetails) => void;
  onClose: () => void;
}

export const EditProfileModal = ({ profile, onSave, onClose }: EditProfileModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ProfileDetails>(profile);

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDraft((current) => ({ ...current, avatarUrl: URL.createObjectURL(file) }));
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40">
      <div className="flex w-[440px] flex-col overflow-y-auto rounded-2xl bg-white">
        <div className="flex h-14 flex-none items-center border-b border-borderGray px-4">
          <span className="text-[15px] font-medium text-ink">Edit profile</span>
          <button onClick={onClose} className="ml-auto text-bodyGray">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex flex-col gap-3.5 p-5">
          <div className="flex items-center gap-3.5">
            <Avatar initials={getInitials(draft.name)} imageSrc={draft.avatarUrl} size="lg" />
            <div className="flex flex-col gap-1">
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                <Icon name="camera" />
                Change photo
              </Button>
              <span className="text-xs text-mutedGray">PNG or JPG, up to 5MB</span>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Full name</span>
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Work email</span>
            <Input
              icon="user"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </div>
          <div className="flex gap-2.5">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Role</span>
              <Input value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-mutedGray">Location</span>
              <Input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
            </div>
          </div>
          <div className="flex">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" className="ml-auto" onClick={() => onSave(draft)}>
              <Icon name="check" />
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
