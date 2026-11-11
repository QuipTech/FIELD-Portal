import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../../auth/adminScope/adminScope.guard';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { GroupMachinesAdminService } from './groupMachinesAdmin.service';
import {
  MoveMachinesToGroupDto,
  SearchMachinesQueryDto,
  SetMachineGroupsDto,
} from '../dto/machineGroupDtos';

// Every organisation's machines, for the platform administrator only: "Add
// machines" on a group searches by plant ID, serial, VIN or organisation name,
// "Manage groups" reads or sets one machine's groups, and "Move to group" on
// the Machines list moves several at once.
@Controller('admin/machines')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminMachineSearchController {
  constructor(private readonly machines: GroupMachinesAdminService) {}

  @Get('search')
  search(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SearchMachinesQueryDto,
  ) {
    return this.machines.searchMachines(actor, query);
  }

  @Post('move-to-group')
  @HttpCode(200)
  moveToGroup(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: MoveMachinesToGroupDto,
  ) {
    return this.machines.moveMachinesToGroup(
      actor,
      dto.machineIds,
      dto.groupId,
    );
  }

  @Get(':machineId/groups')
  listGroups(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.machines.listMachineGroups(actor, machineId);
  }

  @Put(':machineId/groups')
  setGroups(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: SetMachineGroupsDto,
  ) {
    return this.machines.setMachineGroups(actor, machineId, dto.groupIds);
  }
}
