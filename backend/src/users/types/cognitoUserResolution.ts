import { UserRow } from '../../auth/types/authRows';

export interface CognitoSignupProfile {
  companyName: string;
  phoneNumber: string;
}

// `profileRequired`: no FIELD account exists yet and the caller hasn't sent
// the company name + phone number needed to create one.
export type CognitoUserResolution =
  { status: 'resolved'; user: UserRow } | { status: 'profileRequired' };
