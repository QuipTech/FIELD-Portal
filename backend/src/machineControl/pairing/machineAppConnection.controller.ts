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

// The portal's side of connecting a machine's tablet.
@Controller('machines/:machineId/app-connection')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard, RequireActiveMachineGuard)
export class MachineAppConnectionController {
  constructor(private readonly pairing: MachineAppPairingService) {}

  // Polled while a code is waiting to be used.
  @Get()
  @RequirePermissions('machine.view')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.pairing.getConnection(user, machineId);
  }

  @Post('pairing-code')
  @RequirePermissions('machine.manage')
  createCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.pairing.createPairingCode(user, machineId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('machine.manage')
  disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.pairing.disconnect(user, machineId);
  }
}
