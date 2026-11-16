import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  DeleteMachineDto,
  PayFinalChargeDto,
} from './dto/lifecycleActionDtos';
import { toReturnOrigin } from '../billing/personalSubscription/personalCheckout.service';
import { MACHINE_LIFECYCLE_PERMISSION } from './lifecycleTransitions';
import { MachineDeletionService } from './machineDeletion.service';
import { MachineLifecycleService } from './machineLifecycle.service';
import { ActivationQuoteService } from './activationQuote.service';
import { ActivationQuoteQueryDto } from './dto/activationQuoteQueryDto';
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
    private readonly activationQuoteService: ActivationQuoteService,
    private readonly deletionService: MachineDeletionService,
  ) {}

  // What activating machines adds to this month's bill, shown before the
  // admin confirms. Declared before :machineId so it isn't read as an id.
  @Get('lifecycle/activation-quote')
  @RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
  activationQuote(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ActivationQuoteQueryDto,
  ) {
    return this.activationQuoteService.getQuote(actor, query.count);
  }

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

  // Whether it can be deleted yet, and what's in the way.
  @Get(':machineId/deletion-check')
  @RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
  deletionCheck(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
  ) {
    return this.deletionService.checkDeletion(actor, machineId);
  }

  // Raises the days-used charge and returns the Stripe Checkout URL to pay
  // it; Checkout returns to the machine's page. Then delete. Safe to repeat.
  @Post(':machineId/final-charge')
  @HttpCode(200)
  @RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
  payFinalCharge(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: PayFinalChargeDto,
  ) {
    return this.deletionService.payFinalCharge(
      actor,
      machineId,
      `${toReturnOrigin(dto.returnOrigin)}/machines/${machineId}`,
    );
  }

  // 409 with the blocker until it's out of active and its billing is settled.
  @Delete(':machineId')
  @HttpCode(204)
  @RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
  deleteMachine(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: DeleteMachineDto,
  ) {
    return this.deletionService.deleteMachine(actor, machineId, dto.reason);
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
