import { DatabaseService } from '../database/database.service';
import { AuthTokenService } from './authToken.service';
import { StorageService } from '../storage/storage.service';
import { issueSession } from './authSessionIssuer';
import { uniqueTenantSlug } from './uniqueTenantSlug';
import * as authRepository from './auth.repository';
import { assignSignupRole } from './assignSignupRole';
import { RegisterDto } from './dto/registerDto';
import { AuthResponse } from './types/authResponse';

// Self-serve signup: creates the tenant, its first (Customer) user, and an
// audit trail entry, all in one transaction — kept out of AuthService so
// that file stays focused on request-level orchestration.
export const registerTenantAndFirstUser = async (
  databaseService: DatabaseService,
  authTokenService: AuthTokenService,
  storageService: StorageService,
  dto: RegisterDto,
  passwordHash: string,
): Promise<AuthResponse> => {
  const slug = await uniqueTenantSlug(databaseService, dto.companyName);

  return databaseService.transaction(async (client) => {
    const tenant = await authRepository.insertTenant(
      client,
      dto.companyName,
      slug,
    );
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenant.id,
    ]);

    const user = await authRepository.insertUser(client, {
      tenantId: tenant.id,
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    await assignSignupRole(client, { tenantId: tenant.id, userId: user.id });

    await authRepository.insertAuditLog(client, {
      tenantId: tenant.id,
      userId: user.id,
      action: 'create',
      entityId: user.id,
    });

    return issueSession(authTokenService, storageService, client, tenant, user);
  });
};
