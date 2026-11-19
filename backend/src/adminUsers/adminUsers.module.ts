import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MachineSharingModule } from '../machineSharing/machineSharing.module';
import { AdminUsersController } from './adminUsers.controller';
import { AdminOrganisationsController } from './adminOrganisations.controller';
import { AdminUsersService } from './adminUsers.service';
import { AdminUserInvitationsService } from './adminUserInvitations.service';
import { AdminUserRolesService } from './adminUserRoles.service';
import { AdminUserRemovalService } from './adminUserRemoval.service';
import { AdminUserStatusService } from './adminUserStatus.service';

@Module({
  imports: [UsersModule, MachineSharingModule],
  controllers: [AdminUsersController, AdminOrganisationsController],
  providers: [
    AdminUsersService,
    AdminUserInvitationsService,
    AdminUserRolesService,
    AdminUserRemovalService,
    AdminUserStatusService,
  ],
  // Reused by the organisation's own Team screen (src/team).
  exports: [
    AdminUsersService,
    AdminUserInvitationsService,
    AdminUserRolesService,
    AdminUserRemovalService,
    AdminUserStatusService,
  ],
})
export class AdminUsersModule {}
