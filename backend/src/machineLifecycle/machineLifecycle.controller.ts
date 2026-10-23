import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import {
  ApplyLifecycleActionDto,
  BulkLifecycleActionDto,
} from './dto/lifecycleActionDtos';
import { MACHINE_LIFECYCLE_PERMISSION } from './lifecycleTransitions';
import { MachineLifecycleService } from './machineLifecycle.service';
import { MachineTransfersService } from './transfers/machineTransfers.service';

// Activate, deactivate, archive and reactivate (spec section 4), the
// lifecycle history and chain of custody for the machine page. Changes
// need machine.lifecycle; reading needs machine.view.
@Controller('machines')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class MachineLifecycleController {
  constructor(
    private readonly lifecycleService: MachineLifecycleService,
    private readonly transfersService: MachineTransfersService,
  ) {}

  // Declared before :machineId so "lifecycle" isn't read as an id.
  @Post('lifecycle/bulk')
  @HttpCode(200)
  @RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
  applyBulk(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: BulkLifecycleActionDto,
  ) {
    return this.lifecycleService.applyBulkAction(
      actor,
      dto.machineIds,
      dto.action,
      dto.reason ?? null,
    );
  }

  @Get(':machineId/lifecycle')
  @RequirePermissions('machine.view')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.lifecycleService.getLifecycle(actor, machineId);
  }

  @Post(':machineId/lifecycle')
  @HttpCode(200)
  @RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
  apply(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: ApplyLifecycleActionDto,
  ) {
    return this.lifecycleService.applyAction(
      actor,
      machineId,
      dto.action,
      dto.reason ?? null,
    );
  }

  @Get(':machineId/custody')
  @RequirePermissions('machine.view')
  custody(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.transfersService.listChainOfCustody(actor, machineId);
  }
}
