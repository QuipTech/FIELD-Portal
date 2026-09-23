"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EditProfileModal } from "./editProfileModal";
import { getInitials, type ProfileDetails } from "./profileDetails";

const initialProfile: ProfileDetails = {
  name: "Jo Okoye",
  email: "j.okoye@quiptech.com",
  role: "Technician",
  location: "Pit 4",
};

export const ProfileHeaderCard = () => {
  const [profile, setProfile] = useState<ProfileDetails>(initialProfile);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <Card direction="row" className="items-center gap-4">
        <Avatar initials={getInitials(profile.name)} imageSrc={profile.avatarUrl} size="lg" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[17px] font-medium text-ink">{profile.name}</span>
          <span className="text-xs text-mutedGray">
            {profile.email} · {profile.role} · {profile.location}
          </span>
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
          onClose={() => setIsEditing(false)}
        />
      )}
    </>
  );
};
