import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { AssignTechnicianDto } from './dto/assignTechnicianDto';
import { MachineAssignmentsService } from './machineAssignments.service';

// Technicians assigned to a machine. Anyone who can see the machine sees
// them; machine.manage assigns and unassigns.
@Controller('machines/:machineId/technicians')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class MachineAssignmentsController {
  constructor(private readonly assignments: MachineAssignmentsService) {}

  @Get()
  @RequirePermissions('machine.view')
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.assignments.listTechnicians(actor, machineId);
  }

  // Returns the machine's technicians after the change.
  @Post()
  @RequirePermissions('machine.manage')
  assign(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: AssignTechnicianDto,
  ) {
    return this.assignments.assignTechnician(actor, machineId, dto.userId);
  }

  @Delete(':userId')
  @RequirePermissions('machine.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  unassign(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.assignments.unassignTechnician(actor, machineId, userId);
  }
}
