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
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { ORGANISATION_ADMIN_PERMISSION } from './access/machineScope';
import { MachineGroupsService } from './machineGroups.service';
import {
  CreateMachineGroupDto,
  DeleteMachineGroupQueryDto,
  UpdateMachineGroupDto,
} from './dto/machineGroupDtos';

// The caller's own organisation's machine groups (customers), for
// organisation admins only. People limited to groups read theirs from
// GET /auth/me instead.
@Controller('machine-groups')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(ORGANISATION_ADMIN_PERMISSION)
export class MachineGroupsController {
  constructor(private readonly machineGroups: MachineGroupsService) {}

  // With machine and user counts.
  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.machineGroups.listGroups(actor);
  }

  // Plus the people who have access to it. Its machines: GET /machines?groupId=.
  @Get(':groupId')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.machineGroups.getGroup(actor, groupId);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateMachineGroupDto,
  ) {
    return this.machineGroups.createGroup(actor, dto);
  }

  @Patch(':groupId')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateMachineGroupDto,
  ) {
    return this.machineGroups.updateGroup(actor, groupId, dto);
  }

  // 409 group_has_machines unless ?force=true when it still has machines.
  @Delete(':groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: DeleteMachineGroupQueryDto,
  ) {
    return this.machineGroups.deleteGroup(actor, groupId, query.force ?? false);
  }
}
