import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { getPortalOrigins } from '../../common/security/portalOrigins';
import { StripeService } from '../stripe/stripe.service';
import * as customerBillingRepository from './customerBilling.repository';
import { BillingAccountRef } from './customerBilling.repository';
import { CustomerInvoice, toCustomerInvoice } from './customerInvoiceMapper';

const NO_ACCOUNT_MESSAGE = "There's no billing account set up yet.";
const NO_STRIPE_CUSTOMER_MESSAGE =
  "Billing isn't set up with our payment provider yet.";
const INVOICE_NOT_FOUND_MESSAGE = 'Invoice not found.';
const PDF_NOT_READY_MESSAGE = "This invoice's PDF isn't available yet.";

export type BillingOwner = 'organisation' | 'personal';

// What a customer (the organisation's billing admin, or a personal TECH
// subscriber) sees of their billing: invoices, Stripe's PDF of each, and a
// Customer Portal session for payment methods. FIELD stays the source of
// amounts; Stripe only presents and collects.
@Injectable()
export class CustomerBillingService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly stripe: StripeService,
    private readonly configService: ConfigService,
  ) {}

  listInvoices = async (
    actor: AuthenticatedUser,
    owner: BillingOwner,
  ): Promise<CustomerInvoice[]> => {
    const account = await this.findAccount(actor, owner);
    if (!account) return [];
    const rows = await customerBillingRepository.listAccountInvoices(
      this.serviceDatabase,
      account.billing_account_id,
    );
    return rows.map(toCustomerInvoice);
  };

  // A short-lived link to Stripe's PDF.
  getInvoicePdf = async (
    actor: AuthenticatedUser,
    owner: BillingOwner,
    invoiceId: string,
  ): Promise<{ url: string }> => {
    const account = await this.requireAccount(actor, owner);
    const stripeInvoiceId =
      await customerBillingRepository.findAccountStripeInvoiceId(
        this.serviceDatabase,
        { billingAccountId: account.billing_account_id, invoiceId },
      );
    if (!stripeInvoiceId)
      throw new NotFoundException(INVOICE_NOT_FOUND_MESSAGE);
    const url = await this.stripe.getInvoicePdfUrl(stripeInvoiceId);
    if (!url) throw new NotFoundException(PDF_NOT_READY_MESSAGE);
    return { url };
  };

  createPortalSession = async (
    actor: AuthenticatedUser,
    owner: BillingOwner,
  ): Promise<{ url: string }> => {
    const account = await this.requireAccount(actor, owner);
    if (!account.stripe_customer_id) {
      throw new NotFoundException(NO_STRIPE_CUSTOMER_MESSAGE);
    }
    const session = await this.stripe.createPortalSession(
      account.stripe_customer_id,
      this.portalReturnUrl(),
    );
    return { url: session.url };
  };

  private findAccount = (
    actor: AuthenticatedUser,
    owner: BillingOwner,
  ): Promise<BillingAccountRef | null> =>
    owner === 'organisation'
      ? customerBillingRepository.findOrganisationAccount(
          this.serviceDatabase,
          actor.tenantId,
        )
      : customerBillingRepository.findPersonalAccount(this.serviceDatabase, {
          userId: actor.userId,
          tenantId: actor.tenantId,
        });

  private requireAccount = async (
    actor: AuthenticatedUser,
    owner: BillingOwner,
  ): Promise<BillingAccountRef> => {
    const account = await this.findAccount(actor, owner);
    if (!account) throw new NotFoundException(NO_ACCOUNT_MESSAGE);
    return account;
  };

  // Where Stripe sends the customer back: BILLING_PORTAL_RETURN_URL (e.g.
  // the app's deep link), else the portal's billing settings.
  private portalReturnUrl = (): string =>
    this.configService.get<string>('BILLING_PORTAL_RETURN_URL') ??
    `${getPortalOrigins()[0]}/settings/billing`;
}
