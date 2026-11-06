import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../../auth/adminScope/adminScope.guard';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { MachineGroupsAdminService } from './machineGroupsAdmin.service';
import { GroupMachinesAdminService } from './groupMachinesAdmin.service';
import { GroupAssignmentsAdminService } from './groupAssignmentsAdmin.service';
import {
  AddGroupMachinesDto,
  CreateMachineGroupDto,
  GrantAssignmentDto,
  RevokeShareDto,
  UpdateMachineGroupDto,
} from '../dto/machineGroupDtos';

// Admin view → Machine groups: the platform administrator's global groups,
// their machines (from any organisation) and who they are shared with.
// AdminScopeGuard admits only platform.manage; RLS checks it again.
@Controller('admin/machine-groups')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminMachineGroupsController {
  constructor(
    private readonly groups: MachineGroupsAdminService,
    private readonly machines: GroupMachinesAdminService,
    private readonly assignments: GroupAssignmentsAdminService,
  ) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.groups.listGroups(actor);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateMachineGroupDto,
  ) {
    return this.groups.createGroup(actor, dto);
  }

  @Get(':groupId')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.groups.getGroup(actor, groupId);
  }

  @Patch(':groupId')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateMachineGroupDto,
  ) {
    return this.groups.updateGroup(actor, groupId, dto);
  }

  // Ends every assignment of the group too.
  @Delete(':groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.groups.deleteGroup(actor, groupId);
  }

  @Get(':groupId/activity')
  activity(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.groups.listActivity(actor, groupId);
  }

  @Get(':groupId/machines')
  listMachines(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.machines.listMachines(actor, groupId);
  }

  @Post(':groupId/machines')
  addMachines(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AddGroupMachinesDto,
  ) {
    return this.machines.addMachines(actor, groupId, dto.machineIds);
  }

  @Delete(':groupId/machines/:machineId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMachine(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.machines.removeMachine(actor, groupId, machineId);
  }

  @Get(':groupId/assignments')
  listAssignments(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.assignments.listAssignments(actor, groupId);
  }

  @Post(':groupId/assignments')
  grant(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: GrantAssignmentDto,
  ) {
    return this.assignments.grant(actor, groupId, dto);
  }

  @Delete(':groupId/assignments/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: RevokeShareDto,
  ) {
    return this.assignments.revoke(
      actor,
      { groupId, assignmentId },
      dto.reason,
    );
  }
}
