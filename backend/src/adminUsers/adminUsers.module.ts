import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MachineGroupsModule } from '../machineGroups/machineGroups.module';
import { AdminUsersController } from './adminUsers.controller';
import { AdminOrganisationsController } from './adminOrganisations.controller';
import { AdminUsersService } from './adminUsers.service';
import { AdminUserInvitationsService } from './adminUserInvitations.service';
import { AdminUserRolesService } from './adminUserRoles.service';
import { AdminUserRemovalService } from './adminUserRemoval.service';

@Module({
  imports: [UsersModule, MachineGroupsModule],
  controllers: [AdminUsersController, AdminOrganisationsController],
  providers: [
    AdminUsersService,
    AdminUserInvitationsService,
    AdminUserRolesService,
    AdminUserRemovalService,
  ],
  // Reused by the organisation's own Team screen (src/team).
  exports: [
    AdminUsersService,
    AdminUserInvitationsService,
    AdminUserRolesService,
    AdminUserRemovalService,
  ],
})
export class AdminUsersModule {}
