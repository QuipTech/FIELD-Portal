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
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PersonalSubscriptionService } from './personalSubscription.service';
import { PersonalInvoiceService } from './personalInvoice.service';
import { PersonalPaymentCheckService } from './personalPaymentCheck.service';
import { PersonalPaymentDto } from './personalPaymentDto';

@Controller('me/billing')
@UseGuards(JwtAuthGuard)
export class PersonalSubscriptionController {
  constructor(
    private readonly subscriptions: PersonalSubscriptionService,
    private readonly invoices: PersonalInvoiceService,
    private readonly paymentCheck: PersonalPaymentCheckService,
  ) {}

  @Get()
  getStatus(@CurrentUser() actor: AuthenticatedUser) {
    return this.subscriptions.getStatus(actor);
  }

  @Get('invoices')
  listInvoices(@CurrentUser() actor: AuthenticatedUser) {
    return this.subscriptions.listInvoices(actor);
  }

  // Payment Sheet for an earlier unpaid invoice of the caller's; 404 for
  // anyone else's (or a malformed id).
  @Post('invoices/:invoiceId/payment-sheet')
  @HttpCode(200)
  invoicePaymentSheet(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', new ParseUUIDPipe({ errorHttpStatusCode: 404 }))
    invoiceId: string,
  ) {
    return this.invoices.paymentSheetForInvoice(actor, invoiceId);
  }

  @Post('payment')
  createPayment(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() address: PersonalPaymentDto,
  ) {
    return this.invoices.createPayment(actor, address);
  }

  @Post('payment/check')
  checkPayment(@CurrentUser() actor: AuthenticatedUser) {
    return this.paymentCheck.checkPayment(actor);
  }
}
