import { clearAuthSession } from "./authSession";
import { signOutOfCognito } from "./cognitoFederatedSignIn";

// Forgets the session in this browser and leaves for /login. Google/Apple
// users leave via Cognito's logout redirect instead, so `goToLogin` only
// runs for everyone else.
export const endLocalSession = async (goToLogin: () => void): Promise<void> => {
  clearAuthSession();
  await signOutOfCognito().catch(() => undefined);
  goToLogin();
};
