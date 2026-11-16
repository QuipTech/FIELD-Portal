import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { MC_PERMISSIONS } from '../access/machineControlAccess';
import { RequireMachineControlGuard } from '../access/requireMachineControl.guard';
import { McDevicesService } from './mcDevices.service';

@Controller('mc/devices')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard, RequireMachineControlGuard)
export class McDevicesController {
  constructor(private readonly devices: McDevicesService) {}

  @Get()
  @RequirePermissions(MC_PERMISSIONS.view)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.devices.listDevices(user);
  }
}
