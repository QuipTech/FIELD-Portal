import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PersonalSubscriptionService } from './personalSubscription.service';
import { PersonalInvoiceService } from './personalInvoice.service';
import { PersonalPaymentDto } from './personalPaymentDto';

@Controller('me/billing')
@UseGuards(JwtAuthGuard)
export class PersonalSubscriptionController {
  constructor(
    private readonly subscriptions: PersonalSubscriptionService,
    private readonly invoices: PersonalInvoiceService,
  ) {}

  @Get()
  getStatus(@CurrentUser() actor: AuthenticatedUser) {
    return this.subscriptions.getStatus(actor);
  }

  @Get('invoices')
  listInvoices(@CurrentUser() actor: AuthenticatedUser) {
    return this.subscriptions.listInvoices(actor);
  }

  @Post('payment')
  createPayment(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() address: PersonalPaymentDto,
  ) {
    return this.invoices.createPayment(actor, address);
  }
}
