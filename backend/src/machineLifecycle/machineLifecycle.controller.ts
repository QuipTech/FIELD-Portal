import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import {
  parseRequestSource,
  REQUEST_SOURCE_HEADER,
} from '../common/requestSource/requestSource';
import { MACHINE_LIFECYCLE_PERMISSION } from './lifecycleTransitions';
import { MachineDeletionService } from './machineDeletion.service';
import { MachineLifecycleService } from './machineLifecycle.service';
import { ActivationQuoteService } from './activationQuote.service';
import { ActivationQuoteQueryDto } from './dto/activationQuoteQueryDto';
import { PromoCodeDto } from '../billing/discounts/promoCodesDtos';
import { PromoCodesService } from '../billing/discounts/promoCodes.service';
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
    private readonly promoCodes: PromoCodesService,
  ) {}

  // Promo codes in the Activate dialog, for whoever can activate machines
  // (not only billing.manage): the organisation's current promo, checking a
  // code, and applying it just before activating. The discount then comes
  // off the organisation's machine charges. Declared before :machineId.
  @Get('lifecycle/activation-promo')
  @RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
  currentActivationPromo(@CurrentUser() actor: AuthenticatedUser) {
    return this.promoCodes.findCurrentForOrganisation(actor);
  }

  @Post('lifecycle/activation-promo/validate')
  @HttpCode(200)
  @RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
  validateActivationPromo(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PromoCodeDto,
  ) {
    return this.promoCodes.validate(actor, dto.code);
  }

  @Post('lifecycle/activation-promo')
  @RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
  redeemActivationPromo(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PromoCodeDto,
  ) {
    return this.promoCodes.redeem(actor, dto.code);
  }

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
  // paymentMethod 'bank_transfer' sends the invoice with the bank details
  // instead (no paymentUrl); it's settled once an admin marks it paid.
  // Any client but the portal (X-Field-Client: web) is the mobile app and
  // also gets paymentSheet. The header only picks how to pay: payment is
  // still confirmed by Stripe, never by the client.
  @Post(':machineId/final-charge')
  @HttpCode(200)
  @RequirePermissions(MACHINE_LIFECYCLE_PERMISSION)
  payFinalCharge(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('machineId', ParseUUIDPipe) machineId: string,
    @Body() dto: PayFinalChargeDto,
    @Headers(REQUEST_SOURCE_HEADER) client?: string,
  ) {
    return this.deletionService.payFinalCharge(
      actor,
      machineId,
      `${toReturnOrigin(dto.returnOrigin)}/machines/${machineId}`,
      undefined,
      {
        inApp: parseRequestSource(client) !== 'web',
        method: dto.paymentMethod,
      },
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
