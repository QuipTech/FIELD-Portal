"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EditProfileModal } from "./editProfileModal";
import { useSignedInProfile } from "@/lib/auth/useSignedInProfile";
import { getInitials } from "@/lib/format/nameInitials";
import { toProfileDetails, type ProfileDetails } from "./profileDetails";

export const ProfileHeaderCard = () => {
  const signedInProfile = useSignedInProfile();
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (signedInProfile) setProfile(toProfileDetails(signedInProfile));
  }, [signedInProfile]);

  if (!profile) return null;

  const caption = [profile.email, profile.role, profile.location, signedInProfile?.tenant?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Card direction="row" className="items-center gap-4">
        <Avatar initials={getInitials(profile.name)} imageSrc={profile.avatarUrl} size="lg" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[17px] font-medium text-ink">{profile.name}</span>
          <span className="text-xs text-mutedGray">{caption}</span>
        </div>
        <Button size="sm" className="ml-auto" onClick={() => setIsEditing(true)}>
          Edit profile
        </Button>
      </Card>
      {isEditing && (
        <EditProfileModal
          profile={profile}
          onSave={(updated) => {
            setProfile(updated);
            setIsEditing(false);
          }}
          onAvatarUploaded={(avatarUrl) => setProfile((current) => (current ? { ...current, avatarUrl } : current))}
          onClose={() => setIsEditing(false)}
        />
      )}
    </>
  );
};
