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
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PlatformAdminOnly } from '../platformAdminOnly.decorator';
import { AccountSuspensionService } from '../collections/accountSuspension.service';
import { CreditNotesService } from '../collections/creditNotes.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { BillingSettingsService } from '../billingSettings/billingSettings.service';
import { EnterpriseContractService } from '../subscriptions/enterpriseContract.service';
import {
  ConfigValueDto,
  CreditNoteDto,
  EnterpriseContractDto,
  NewPriceBookDto,
  OnboardingQueryDto,
  ReasonDto,
  ReviewTaskQueryDto,
  ReviewTaskUpdateDto,
  ScheduleOnboardingDto,
} from './billingOperationsDtos';

// The platform admin's billing operations: suspension, Enterprise
// contracts, credit notes, assisted onboarding, price books, billing
// settings and review tasks. Every change is audited by its service.
@Controller('admin/billing')
@PlatformAdminOnly()
export class AdminBillingOperationsController {
  constructor(
    private readonly suspension: AccountSuspensionService,
    private readonly enterprise: EnterpriseContractService,
    private readonly creditNotes: CreditNotesService,
    private readonly onboarding: OnboardingService,
    private readonly settings: BillingSettingsService,
  ) {}

  @Post('accounts/:accountId/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: ReasonDto,
  ) {
    return this.suspension.suspend(actor, accountId, dto.reason);
  }

  @Post('accounts/:accountId/unsuspend')
  @HttpCode(HttpStatus.OK)
  unsuspend(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: ReasonDto,
  ) {
    return this.suspension.unsuspend(actor, accountId, dto.reason);
  }

  @Post('accounts/:accountId/enterprise')
  setUpEnterprise(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: EnterpriseContractDto,
  ) {
    return this.enterprise.setUpContract(actor, accountId, dto);
  }

  @Get('invoices/:invoiceId/credit-notes')
  listCreditNotes(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.creditNotes.list(invoiceId);
  }

  @Post('invoices/:invoiceId/credit-notes')
  createCreditNote(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: CreditNoteDto,
  ) {
    return this.creditNotes.create(actor, invoiceId, dto);
  }

  @Post('credit-notes/:creditNoteId/retry')
  @HttpCode(HttpStatus.OK)
  retryCreditNote(@Param('creditNoteId', ParseUUIDPipe) creditNoteId: string) {
    return this.creditNotes.retry(creditNoteId);
  }

  @Get('onboarding')
  listOnboarding(@Query() query: OnboardingQueryDto) {
    return this.onboarding.list(query.billingAccountId ?? null);
  }

  @Post('onboarding')
  scheduleOnboarding(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ScheduleOnboardingDto,
  ) {
    return this.onboarding.schedule(actor, dto.billingAccountId, dto.siteName);
  }

  @Post('onboarding/:jobId/complete')
  @HttpCode(HttpStatus.OK)
  completeOnboarding(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ) {
    return this.onboarding.complete(actor, jobId);
  }

  @Post('onboarding/:jobId/waive')
  @HttpCode(HttpStatus.OK)
  waiveOnboarding(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: ReasonDto,
  ) {
    return this.onboarding.waive(actor, jobId, dto.reason);
  }

  @Get('price-books')
  listPriceBooks() {
    return this.settings.listPriceBooks();
  }

  @Post('price-books')
  createPriceBook(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: NewPriceBookDto,
  ) {
    return this.settings.createPriceBook(actor, {
      planCode: dto.planCode,
      effectiveFrom: dto.effectiveFrom,
      unitCents: dto.unitCents ?? null,
      minimumAnnualCents: dto.minimumAnnualCents ?? null,
      bands: dto.bands.map((band) => ({
        lowerQty: band.lowerQty,
        upperQty: band.upperQty ?? null,
        unitCents: band.unitCents,
      })),
    });
  }

  @Get('config')
  listConfig() {
    return this.settings.listConfig();
  }

  @Put('config/:key')
  updateConfig(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: ConfigValueDto,
  ) {
    return this.settings.updateConfig(actor, key, dto.value);
  }

  @Get('review-tasks')
  listReviewTasks(@Query() query: ReviewTaskQueryDto) {
    return this.settings.listReviewTasks(query.status ?? null);
  }

  @Patch('review-tasks/:taskId')
  updateReviewTask(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ReviewTaskUpdateDto,
  ) {
    return this.settings.updateReviewTask(actor, taskId, {
      status: dto.status,
      notes: dto.notes ?? null,
    });
  }
}
