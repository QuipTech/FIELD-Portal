import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { toBillingDay } from '../billingCalendar/billingDay';
import { BILLING_MANAGE_PERMISSION } from '../customerBilling/billingPermissions';
import { PromoCodeDto } from '../discounts/promoCodesDtos';
import { PromoCodesService } from '../discounts/promoCodes.service';
import {
  AccountApplicationDto,
  PaymentTypeChoiceDto,
  PoNumberDto,
} from './accountTermsDtos';
import { AccountTermsService } from './accountTerms.service';

// How the organisation pays (billing.manage: Owner, Organisation Admin):
// card or a 30-day account application, PO numbers, and promo codes.
@Controller('organisation/billing')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
@RequirePermissions(BILLING_MANAGE_PERMISSION)
export class OrganisationPaymentTermsController {
  constructor(
    private readonly terms: AccountTermsService,
    private readonly promoCodes: PromoCodesService,
  ) {}

  // Payment type, application, free period, current promo and the monthly
  // draft still open for a PO number.
  @Get('payment-terms')
  async getPaymentTerms(@CurrentUser() actor: AuthenticatedUser) {
    const terms = await this.terms.getOrganisationTerms(actor);
    const today = toBillingDay(new Date(), terms.timezone);
    const [promo, draft] = await Promise.all([
      this.promoCodes.findCurrentRedemption(terms.billingAccountId, today),
      this.terms.findDraftMonthlyInvoice(terms.billingAccountId),
    ]);
    return {
      ...terms,
      promo,
      draftInvoice: draft
        ? {
            id: draft.id,
            periodStart: draft.period_start,
            reviewUntil: draft.review_until?.toISOString() ?? null,
            poNumber: draft.po_number,
          }
        : null,
    };
  }

  @Post('account-application')
  apply(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AccountApplicationDto,
  ) {
    return this.terms.apply(actor, {
      legalName: dto.legalName,
      abn: dto.abn,
      accountsEmail: dto.accountsEmail,
      accountsPhone: dto.accountsPhone,
      poRequired: dto.poRequired,
      notes: dto.notes ?? null,
    });
  }

  @Put('payment-type')
  async choosePaymentType(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() choice: PaymentTypeChoiceDto,
  ) {
    // The DTO only accepts 'card'; account terms need an application.
    if (choice.paymentType !== 'card')
      throw new BadRequestException('Apply for a 30-day account instead.');
    return this.terms.chooseCard(actor);
  }

  @Put('po-number')
  setPoNumber(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PoNumberDto,
  ) {
    return this.terms.setDefaultPoNumber(actor, dto.poNumber);
  }

  @Put('invoices/:invoiceId/po-number')
  setInvoicePoNumber(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: PoNumberDto,
  ) {
    return this.terms.setInvoicePoNumber(actor, invoiceId, dto.poNumber);
  }

  @Post('promo-code/validate')
  @HttpCode(HttpStatus.OK)
  validatePromoCode(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PromoCodeDto,
  ) {
    return this.promoCodes.validate(actor, dto.code);
  }

  @Post('promo-code')
  redeemPromoCode(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PromoCodeDto,
  ) {
    return this.promoCodes.redeem(actor, dto.code);
  }
}
