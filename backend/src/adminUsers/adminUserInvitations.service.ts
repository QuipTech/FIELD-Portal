import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import * as authRepository from '../auth/auth.repository';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import { CognitoUserDirectoryService } from '../users/cognitoUserDirectory.service';
import * as adminUsersRepository from './adminUsers.repository';
import * as adminRolesRepository from '../adminRoles/adminRoles.repository';
import { InviteUserDto } from './dto/inviteUserDto';

const ALREADY_USER_MESSAGE =
  'Someone with this email already has a FIELD account.';
const OTHER_ORGANISATION_MESSAGE =
  'You can only invite people to your own organisation.';
const ORGANISATION_NOT_FOUND_MESSAGE = 'Organisation not found.';
const ROLE_NOT_ALLOWED_MESSAGE =
  "That role can't be given to people in this organisation.";
const COGNITO_NOT_SET_UP_MESSAGE =
  "Inviting isn't set up yet: the server isn't allowed to create sign-in accounts (cognito-idp:AdminCreateUser).";
const CHECK_VIOLATION = '23514';

// Users → Invite user. Cognito creates the sign-in and emails a temporary
// password; then the FIELD account is saved as 'invited' with its role.
// If saving fails, the Cognito user is removed again so a retry starts
// clean. The Owner invites into any organisation (default: their own).
@Injectable()
export class AdminUserInvitationsService {
  private readonly logger = new Logger(AdminUserInvitationsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cognitoDirectory: CognitoUserDirectoryService,
  ) {}

  inviteUser = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    dto: InviteUserDto,
  ): Promise<{ id: string }> => {
    const tenantId = await this.resolveOrganisation(actor, scope, dto);
    // Checked before Cognito, so a bad request never emails anyone.
    await this.assertRoleAssignable(tenantId, dto.roleId);
    if (
      await authRepository.findUserByEmailForLogin(
        this.databaseService,
        dto.email,
      )
    ) {
      throw new ConflictException(ALREADY_USER_MESSAGE);
    }
    const cognitoUser = await this.createCognitoUser(dto);
    try {
      const id = await runAuditedChange(
        this.databaseService,
        actor,
        ALREADY_USER_MESSAGE,
        async (client) => {
          const userId = await adminUsersRepository.insertInvitedUser(client, {
            tenantId,
            email: dto.email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            cognitoSub: cognitoUser.sub,
            roleId: dto.roleId,
          });
          return {
            result: userId,
            audit: {
              action: 'create',
              entityType: 'user',
              entityId: userId,
              metadata: { invited: true, roleId: dto.roleId, tenantId },
            },
          };
        },
      );
      return { id };
    } catch (error) {
      await this.cognitoDirectory
        .deleteUser(cognitoUser.username)
        .catch((cleanupError: unknown) =>
          this.logger.warn(
            `Couldn't remove Cognito user ${cognitoUser.username}: ${String(cleanupError)}`,
          ),
        );
      if ((error as { code?: string }).code === CHECK_VIOLATION) {
        throw new BadRequestException(ROLE_NOT_ALLOWED_MESSAGE);
      }
      throw error;
    }
  };

  private resolveOrganisation = async (
    actor: AuthenticatedUser,
    scope: AdminScope,
    dto: InviteUserDto,
  ): Promise<string> => {
    const tenantId = dto.organisationId ?? actor.tenantId;
    if (!scope.isPlatform && tenantId !== actor.tenantId) {
      throw new ForbiddenException(OTHER_ORGANISATION_MESSAGE);
    }
    const organisations = await adminUsersRepository.listOrganisations(
      this.databaseService,
      scope,
    );
    if (!organisations.some((organisation) => organisation.id === tenantId)) {
      throw new NotFoundException(ORGANISATION_NOT_FOUND_MESSAGE);
    }
    return tenantId;
  };

  // A system role or one of that organisation's own;
  // admin_invite_user checks the same again when saving.
  private assertRoleAssignable = async (
    tenantId: string,
    roleId: string,
  ): Promise<void> => {
    const [role] = await adminRolesRepository.listRoles(
      this.databaseService,
      { tenantId, isPlatform: false },
      roleId,
    );
    if (!role) {
      throw new BadRequestException(ROLE_NOT_ALLOWED_MESSAGE);
    }
  };

  private createCognitoUser = async (dto: InviteUserDto) => {
    try {
      return await this.cognitoDirectory.createInvitedUser(dto);
    } catch (error) {
      const name = (error as { name?: string }).name;
      this.logger.warn(
        `Cognito invite for ${dto.email} failed: ${name} ${String(error)}`,
      );
      if (name === 'UsernameExistsException')
        throw new ConflictException(ALREADY_USER_MESSAGE);
      if (name === 'AccessDeniedException')
        throw new ServiceUnavailableException(COGNITO_NOT_SET_UP_MESSAGE);
      throw error;
    }
  };
}
