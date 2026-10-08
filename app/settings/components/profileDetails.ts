import type { SignedInProfile } from "@/lib/types/authSession";

export interface ProfileDetails {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export const toProfileDetails = (signedIn: SignedInProfile): ProfileDetails => ({
  name: `${signedIn.user.firstName} ${signedIn.user.lastName}`.trim(),
  email: signedIn.user.email,
  role: signedIn.user.roles.join(", "),
  avatarUrl: signedIn.user.avatarUrl ?? undefined,
});
