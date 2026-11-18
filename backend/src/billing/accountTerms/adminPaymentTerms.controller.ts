import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { trimString } from '../../common/utils/trimTransforms';
import { ReasonDto } from '../billingOperations/billingOperationsDtos';
import { OverdueListService } from '../collections/overdueList.service';
import {
  CreatePromoCodeDto,
  PromoCodeTermsDto,
} from '../discounts/promoCodesDtos';
import { PromoCodesService } from '../discounts/promoCodes.service';
import {
  MarkInvoicePaidService,
  PaymentMethod,
} from '../invoices/markInvoicePaid.service';
import { PlatformAdminOnly } from '../platformAdminOnly.decorator';
import {
  ApplicationsQueryDto,
  ApproveApplicationDto,
  CreditLimitDto,
  FreePeriodDto,
  PaymentTermsDto,
} from './accountTermsDtos';
import { AccountTermsService } from './accountTerms.service';
import { FreePeriodService } from './freePeriod.service';

export class MarkPaidDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'paidOn must be a date (YYYY-MM-DD).',
  })
  paidOn: string;

  @IsIn(['bank_transfer', 'cheque', 'cash', 'other'])
  method: PaymentMethod;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  reference?: string;
}

class ActiveDto {
  @IsIn([true, false])
  active: boolean;
}

// The platform administrator's (super admin's) payment terms work: 30-day
// account applications, switching card ↔ account, credit limits, free
// periods, the overdue list, marking account invoices paid, and promo
// codes. Every change is audited by its service.
@Controller('admin/billing')
@PlatformAdminOnly()
export class AdminPaymentTermsController {
  constructor(
    private readonly terms: AccountTermsService,
    private readonly freePeriods: FreePeriodService,
    private readonly overdue: OverdueListService,
    private readonly markPaid: MarkInvoicePaidService,
    private readonly promoCodes: PromoCodesService,
  ) {}

  @Get('account-applications')
  listApplications(@Query() query: ApplicationsQueryDto) {
    return this.terms.listApplications(query.status ?? null);
  }

  @Post('accounts/:accountId/account-application/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: ApproveApplicationDto,
  ) {
    return this.terms.approve(actor, accountId, {
      termsDays: dto.termsDays ?? null,
      creditLimitCents: dto.creditLimitCents ?? null,
      notes: dto.notes ?? null,
    });
  }

  @Post('accounts/:accountId/account-application/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: ReasonDto,
  ) {
    return this.terms.reject(actor, accountId, dto.reason);
  }

  @Post('accounts/:accountId/account-application/hold')
  @HttpCode(HttpStatus.OK)
  hold(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: ReasonDto,
  ) {
    return this.terms.hold(actor, accountId, dto.reason);
  }

  @Put('accounts/:accountId/payment-terms')
  setPaymentTerms(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: PaymentTermsDto,
  ) {
    return this.terms.setPaymentTerms(actor, accountId, {
      paymentType: dto.paymentType,
      termsDays: dto.termsDays ?? null,
      creditLimitCents: dto.creditLimitCents ?? null,
      poRequired: dto.poRequired ?? null,
      reason: dto.reason,
    });
  }

  @Put('accounts/:accountId/credit-limit')
  setCreditLimit(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: CreditLimitDto,
  ) {
    return this.terms.setCreditLimit(
      actor,
      accountId,
      dto.creditLimitCents,
      dto.reason,
    );
  }

  @Put('accounts/:accountId/free-period')
  setFreePeriod(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: FreePeriodDto,
  ) {
    return this.freePeriods.set(actor, accountId, {
      freeUntil: dto.freeUntil,
      freePercent: dto.freePercent ?? 100,
      reason: dto.reason,
    });
  }

  @Post('accounts/:accountId/free-period/clear')
  @HttpCode(HttpStatus.OK)
  clearFreePeriod(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: ReasonDto,
  ) {
    return this.freePeriods.clear(actor, accountId, dto.reason);
  }

  @Get('overdue')
  listOverdue() {
    return this.overdue.list();
  }

  @Post('invoices/:invoiceId/mark-paid')
  @HttpCode(HttpStatus.OK)
  markInvoicePaid(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.markPaid.markPaid(actor, invoiceId, {
      paidOn: dto.paidOn,
      method: dto.method,
      reference: dto.reference || null,
    });
  }

  @Get('promo-codes')
  listPromoCodes() {
    return this.promoCodes.list();
  }

  @Post('promo-codes')
  createPromoCode(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePromoCodeDto,
  ) {
    return this.promoCodes.create(actor, {
      code: dto.code,
      ...toPromoTerms(dto),
    });
  }

  @Patch('promo-codes/:promoCodeId')
  updatePromoCode(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('promoCodeId', ParseUUIDPipe) promoCodeId: string,
    @Body() dto: PromoCodeTermsDto,
  ) {
    return this.promoCodes.update(actor, promoCodeId, toPromoTerms(dto));
  }

  @Put('promo-codes/:promoCodeId/active')
  setPromoCodeActive(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('promoCodeId', ParseUUIDPipe) promoCodeId: string,
    @Body() dto: ActiveDto,
  ) {
    return this.promoCodes.setActive(actor, promoCodeId, dto.active);
  }

  @Get('promo-codes/:promoCodeId/redemptions')
  listRedemptions(@Param('promoCodeId', ParseUUIDPipe) promoCodeId: string) {
    return this.promoCodes.listRedemptions(promoCodeId);
  }
}

const toPromoTerms = (dto: PromoCodeTermsDto) => ({
  description: dto.description,
  discountType: dto.discountType,
  discountValue: dto.discountValue,
  durationMonths: dto.durationMonths ?? null,
  validFrom: dto.validFrom ?? null,
  validUntil: dto.validUntil ?? null,
  maxRedemptions: dto.maxRedemptions ?? null,
  newCustomersOnly: dto.newCustomersOnly ?? false,
});
