import { updateProfileRequest, type UserProfile } from "@/lib/api/accountApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { getStoredUser, saveStoredUser } from "@/lib/auth/authSession";

// "Ada van der Berg" → first "Ada", last "van der Berg".
const splitFullName = (fullName: string) => {
  const [firstName = "", ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
};

// Keeps the stored session (read by the header, user menu, etc.) in step
// with what the backend now holds.
export const syncStoredProfile = (profile: UserProfile): void => {
  const storedUser = getStoredUser();
  if (!storedUser) return;
  saveStoredUser({
    ...storedUser,
    firstName: profile.firstName,
    lastName: profile.lastName,
    avatarUrl: profile.avatarUrl,
  });
};

export const saveProfileName = async (fullName: string): Promise<UserProfile> => {
  const profile = await updateProfileRequest(requireAccessToken(), splitFullName(fullName));
  syncStoredProfile(profile);
  return profile;
};
