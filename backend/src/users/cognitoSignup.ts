import { DatabaseService } from '../database/database.service';
import { uniqueTenantSlug } from '../auth/uniqueTenantSlug';
import * as authRepository from '../auth/auth.repository';
import { assignSignupRole } from '../auth/assignSignupRole';
import { UserRow } from '../auth/types/authRows';
import { CognitoIdentity } from '../auth/types/cognitoIdentity';
import * as usersRepository from './users.repository';
import { CognitoSignupProfile } from './types/cognitoUserResolution';

// Self-serve signup via Google/Apple — mirrors registerTenantAndFirstUser
// (/auth/register): a new tenant with this user as its Customer, in one
// transaction, just without a password. Google/Apple don't supply a company
// or phone number, so the signup profile dialog collects them first.
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
