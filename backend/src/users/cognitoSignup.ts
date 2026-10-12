import { DatabaseService } from '../database/database.service';
import { uniqueTenantSlug } from '../auth/uniqueTenantSlug';
import * as authRepository from '../auth/auth.repository';
import { assignSignupRole } from '../auth/assignSignupRole';
import { UserRow } from '../auth/types/authRows';
import { CognitoIdentity } from '../auth/types/cognitoIdentity';
import * as usersRepository from './users.repository';
import { CognitoSignupProfile } from './types/cognitoUserResolution';

// Self-serve signup through Cognito (email/password, Google or Apple): a new
// tenant with this user as its Customer, in one transaction. Cognito holds
// the password, if any. Company and phone number aren't Cognito attributes:
// the portal's register form (email/password) or the signup profile dialog
// (Google/Apple) sends them to /auth/sync.
export const createTenantAndFirstUserFromCognito = async (
  databaseService: DatabaseService,
  identity: CognitoIdentity,
  signupProfile: CognitoSignupProfile,
): Promise<UserRow> => {
  const tenantName = signupProfile.companyName;
  const slug = await uniqueTenantSlug(databaseService, tenantName);

  return databaseService.transaction(async (client) => {
    const tenant = await authRepository.insertTenant(client, tenantName, slug);
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenant.id,
    ]);

    const user = await usersRepository.insertCognitoUser(client, {
      tenantId: tenant.id,
      identity,
      phoneNumber: signupProfile.phoneNumber,
    });

    await assignSignupRole(client, { tenantId: tenant.id, userId: user.id });

    await authRepository.insertAuditLog(client, {
      tenantId: tenant.id,
      userId: user.id,
      action: 'create',
      entityId: user.id,
    });

    return user;
  });
};
