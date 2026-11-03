import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../../auth/adminScope/adminScope.guard';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { GroupMachinesAdminService } from './groupMachinesAdmin.service';
import { SearchMachinesQueryDto } from '../dto/machineGroupDtos';

// "Add machines" on a group: every organisation's machines, by plant ID,
// serial, VIN or organisation name. Platform administrator only.
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
}
