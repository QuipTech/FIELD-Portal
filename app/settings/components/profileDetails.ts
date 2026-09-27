import type { SignedInProfile } from "@/lib/types/authSession";

export interface ProfileDetails {
  name: string;
  email: string;
  role: string;
  location: string;
  avatarUrl?: string;
}

export const toProfileDetails = (signedIn: SignedInProfile): ProfileDetails => ({
  name: `${signedIn.user.firstName} ${signedIn.user.lastName}`.trim(),
  email: signedIn.user.email,
  // Not part of the session yet; filled in via "Edit profile".
  role: "",
  location: "",
  avatarUrl: signedIn.user.avatarUrl ?? undefined,
});
