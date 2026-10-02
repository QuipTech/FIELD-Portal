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

// phoneNumber: E.164, null to remove it, or undefined to leave it as is.
export const saveProfile = async (fullName: string, phoneNumber?: string | null): Promise<UserProfile> => {
  const profile = await updateProfileRequest(requireAccessToken(), { ...splitFullName(fullName), phoneNumber });
  syncStoredProfile(profile);
  return profile;
};
