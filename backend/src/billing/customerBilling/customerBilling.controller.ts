import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwtAuthGuard';
import { RequirePermissionsGuard } from '../../auth/guards/requirePermissions.guard';
import { RequirePermissions } from '../../auth/decorators/requirePermissions.decorator';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { CustomerBillingService } from './customerBilling.service';
import { BILLING_MANAGE_PERMISSION } from './billingPermissions';

const BILLING_ADMIN_PERMISSION = BILLING_MANAGE_PERMISSION;

// Customer-facing billing: the organisation's (billing admins,
// billing.manage) and a personal TECH subscriber's own. A portal
// session URL is single-use: open it straight away.
@Controller()
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class CustomerBillingController {
  constructor(private readonly billing: CustomerBillingService) {}

  @Get('organisation/billing/invoices')
  @RequirePermissions(BILLING_ADMIN_PERMISSION)
  listOrganisationInvoices(@CurrentUser() actor: AuthenticatedUser) {
    return this.billing.listInvoices(actor, 'organisation');
  }

  @Get('organisation/billing/invoices/:invoiceId/pdf')
  @RequirePermissions(BILLING_ADMIN_PERMISSION)
  getOrganisationInvoicePdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billing.getInvoicePdf(actor, 'organisation', invoiceId);
  }

  @Post('organisation/billing/portal-session')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(BILLING_ADMIN_PERMISSION)
  createOrganisationPortalSession(@CurrentUser() actor: AuthenticatedUser) {
    return this.billing.createPortalSession(actor, 'organisation');
  }

  @Get('me/billing/invoices/:invoiceId/pdf')
  getPersonalInvoicePdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billing.getInvoicePdf(actor, 'personal', invoiceId);
  }

  @Post('me/billing/portal-session')
  @HttpCode(HttpStatus.OK)
  createPersonalPortalSession(@CurrentUser() actor: AuthenticatedUser) {
    return this.billing.createPortalSession(actor, 'personal');
  }
}
