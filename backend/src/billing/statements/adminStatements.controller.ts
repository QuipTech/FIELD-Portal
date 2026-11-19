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
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ReasonDto } from '../billingOperations/billingOperationsDtos';
import { PlatformAdminOnly } from '../platformAdminOnly.decorator';
import {
  MonthEndReportQueryDto,
  MonthReadyDto,
  StatementExportQueryDto,
  StatementPaidDto,
  ZohoInvoiceDto,
} from './dto/statementDtos';
import { StatementsService } from './statements.service';

const toFilters = (query: MonthEndReportQueryDto) => ({
  month: query.month,
  paymentType:
    query.paymentType === 'all' ? null : (query.paymentType ?? 'account'),
  status: query.status ?? null,
});

// The platform administrator's month-end report of 30-day account
// statements, its exports, and tracking each statement through Zoho.
@Controller('admin/billing/statements')
@PlatformAdminOnly()
export class AdminStatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Get('report')
  report(@Query() query: MonthEndReportQueryDto) {
    return this.statements.report(toFilters(query));
  }

  @Get('export')
  async export(
    @Query() query: StatementExportQueryDto,
    @Res() response: Response,
  ) {
    const file = await this.statements.export(
      toFilters(query),
      query.format,
      query.invoiceDate ?? null,
    );
    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    response.send(file.body);
  }

  @Get('overdue')
  overdue() {
    return this.statements.listOverdue();
  }

  @Post('months/ready')
  @HttpCode(HttpStatus.OK)
  markMonthReady(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: MonthReadyDto,
  ) {
    return this.statements.markMonthReady(actor, body.month);
  }

  @Get(':statementId/machines')
  machines(@Param('statementId', ParseUUIDPipe) statementId: string) {
    return this.statements.machines(statementId);
  }

  @Patch(':statementId/zoho-invoice')
  setZohoInvoice(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('statementId', ParseUUIDPipe) statementId: string,
    @Body() body: ZohoInvoiceDto,
  ) {
    return this.statements.setZohoInvoice(actor, statementId, {
      invoiceNumber: body.invoiceNumber,
      invoiceDate: body.invoiceDate,
      termsDays: body.termsDays ?? null,
    });
  }

  @Patch(':statementId/paid')
  markPaid(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('statementId', ParseUUIDPipe) statementId: string,
    @Body() body: StatementPaidDto,
  ) {
    return this.statements.markPaid(actor, statementId, {
      paidOn: body.paidOn,
      reference: body.reference || null,
    });
  }

  @Patch(':statementId/void')
  @HttpCode(HttpStatus.NO_CONTENT)
  async voidStatement(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('statementId', ParseUUIDPipe) statementId: string,
    @Body() body: ReasonDto,
  ) {
    await this.statements.voidStatement(actor, statementId, body.reason);
  }
}
