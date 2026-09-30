import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { MachineFleetService } from './machineFleet.service';
import { ListMachinesQueryDto } from './dto/listMachinesQueryDto';
import { RegisterMachineDto } from './dto/registerMachineDto';

// The Machines list. One machine's own routes (/machines/:machineId…)
// live in MachineHistoryController.
@Controller()
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class MachineFleetController {
  constructor(private readonly machineFleetService: MachineFleetService) {}

  @Get('machines')
  @RequirePermissions('machine.view')
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListMachinesQueryDto,
  ) {
    return this.machineFleetService.listMachines(actor, query);
  }

  @Post('machines')
  @RequirePermissions('machine.create')
  register(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RegisterMachineDto,
  ) {
    return this.machineFleetService.registerMachine(actor, dto);
  }

  // Makes and models from the Machine library, for "Add machine".
  @Get('machine-catalog')
  @RequirePermissions('machine.create')
  catalog(@CurrentUser() actor: AuthenticatedUser) {
    return this.machineFleetService.listCatalog(actor);
  }
}
