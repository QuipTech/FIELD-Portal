import {
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
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { RequireActiveMachineGuard } from '../../machineLifecycle/activeMachine/requireActiveMachine.guard';
import { MachineAppPairingService } from './machineAppPairing.service';
import { MC_PERMISSIONS } from '../access/machineControlAccess';
import { RequireMachineControlGuard } from '../access/requireMachineControl.guard';

// The portal's side of connecting a machine's tablet. Needs Machine Control
// turned on for the caller's organisation.
@Controller('machines/:machineId/app-connection')
@UseGuards(
  JwtAuthGuard,
  RequirePermissionsGuard,
  RequireMachineControlGuard,
  RequireActiveMachineGuard,
)
export class MachineAppConnectionController {
  constructor(private readonly pairing: MachineAppPairingService) {}

  // Polled while a code is waiting to be used.
  @Get()
  @RequirePermissions(MC_PERMISSIONS.view)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.pairing.getConnection(user, machineId);
  }

  @Post('pairing-code')
  @RequirePermissions(MC_PERMISSIONS.manageDevices)
  createCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.pairing.createPairingCode(user, machineId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(MC_PERMISSIONS.manageDevices)
  disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.pairing.disconnect(user, machineId);
  }
}
