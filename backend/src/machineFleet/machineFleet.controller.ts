import {
  Body,
  Controller,
  Get,
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
import { MachineFleetService } from './machineFleet.service';
import { ListMachinesQueryDto } from './dto/listMachinesQueryDto';
import { RegisterMachineDto } from './dto/registerMachineDto';
import { UpdateMachineStatusDto } from './dto/updateMachineStatusDto';
import { CorrectIdentifiersDto } from './dto/correctIdentifiersDto';
import { UpdateMachineDto } from './dto/updateMachineDto';
import { MachineIdentifiersService } from './machineIdentifiers.service';
import { MachineDetailsService } from './machineDetails.service';

// The Machines list, registration and status changes. One machine's
// details and history (/machines/:machineId…) live in
// MachineHistoryController.
@Controller()
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class MachineFleetController {
  constructor(
    private readonly machineFleetService: MachineFleetService,
    private readonly machineIdentifiersService: MachineIdentifiersService,
    private readonly machineDetailsService: MachineDetailsService,
  ) {}

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

  // Site, hour-meter reading, cover photo.
  @Patch('machines/:machineId')
  @RequirePermissions('machine.manage')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: UpdateMachineDto,
  ) {
    return this.machineDetailsService.updateMachine(actor, machineId, dto);
  }

  // Running / down / service due. Feeds the dashboard's fleet uptime.
  @Patch('machines/:machineId/status')
  @RequirePermissions('machine.manage')
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: UpdateMachineStatusDto,
  ) {
    return this.machineFleetService.updateStatus(actor, machineId, dto);
  }

  // Serial, fleet, Plant ID and registration corrections, audited with a
  // reason. The machine's id never changes.
  @Patch('machines/:machineId/identifiers')
  @RequirePermissions('machine.manage')
  correctIdentifiers(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: CorrectIdentifiersDto,
  ) {
    return this.machineIdentifiersService.correctIdentifiers(
      actor,
      machineId,
      dto,
    );
  }

  // Makes and models from the Machine library, for "Add machine".
  @Get('machine-catalog')
  @RequirePermissions('machine.create')
  catalog(@CurrentUser() actor: AuthenticatedUser) {
    return this.machineFleetService.listCatalog(actor);
  }
}
