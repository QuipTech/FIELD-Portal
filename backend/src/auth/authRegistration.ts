import { DatabaseService } from '../database/database.service';
import { AuthTokenService } from './authToken.service';
import { issueSession } from './authSessionIssuer';
import { uniqueTenantSlug } from './uniqueTenantSlug';
import * as authRepository from './auth.repository';
import { RegisterDto } from './dto/registerDto';
import { AuthResponse } from './types/authResponse';

const OWNER_ROLE_NAME = 'Owner';

// Self-serve signup: creates the tenant, its first (Owner) user, and an
// audit trail entry, all in one transaction — kept out of AuthService so
// that file stays focused on request-level orchestration.
export const registerTenantAndOwner = async (
  databaseService: DatabaseService,
  authTokenService: AuthTokenService,
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

    const ownerRoleId = await authRepository.findSystemRoleIdByName(
      client,
      OWNER_ROLE_NAME,
    );
    if (ownerRoleId) {
      await authRepository.insertUserRole(client, {
        tenantId: tenant.id,
        userId: user.id,
        roleId: ownerRoleId,
      });
    }

    await authRepository.insertAuditLog(client, {
      tenantId: tenant.id,
      userId: user.id,
      action: 'create',
      entityId: user.id,
    });

    return issueSession(authTokenService, client, tenant, user);
  });
};
