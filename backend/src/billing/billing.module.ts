import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { StripeModule } from './stripe/stripe.module';
import { BillingAccountsController } from './billingAccounts/billingAccounts.controller';
import { BillingAccountsService } from './billingAccounts/billingAccounts.service';
import { InvoicesController } from './invoices/invoices.controller';
import { InvoicesService } from './invoices/invoices.service';
import { InvoiceStripeSyncService } from './invoices/invoiceStripeSync.service';
import { BillingRunWorker } from './monthlyRun/billingRun.worker';
import { InvoiceReviewController } from './monthlyRun/invoiceReview.controller';
import { InvoiceReviewService } from './monthlyRun/invoiceReview.service';
import { MonthlyRunService } from './monthlyRun/monthlyRun.service';
import { InvoiceEmailNotifier } from './invoices/invoiceEmailNotifier.service';
import { StripeWebhookController } from './webhooks/stripeWebhook.controller';
import { StripeWebhookService } from './webhooks/stripeWebhook.service';
import { BillingConfigService } from './billingConfig/billingConfig.service';
import { CustomerBillingController } from './customerBilling/customerBilling.controller';
import { CustomerBillingService } from './customerBilling/customerBilling.service';
import { PlanOptionsController } from './planOptions/planOptions.controller';
import { PlanOptionsService } from './planOptions/planOptions.service';
import { PriceBooksService } from './priceBooks/priceBooks.service';
import { BillingAccountDetailsService } from './billingAccounts/billingAccountDetails.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { EnterpriseContractService } from './subscriptions/enterpriseContract.service';
import { SeatsService } from './seats/seats.service';
import { BillingSignUpService } from './signUp/billingSignUp.service';
import { AnnualQuoteService } from './signUp/annualQuote.service';
import { ReviewTasksService } from './reviewTasks/reviewTasks.service';
import { PersonalSubscriptionController } from './personalSubscription/personalSubscription.controller';
import { PersonalSubscriptionService } from './personalSubscription/personalSubscription.service';
import { PersonalInvoiceService } from './personalSubscription/personalInvoice.service';

// FIELD-calculated invoicing: FIELD owns every amount, Stripe presents the
// invoice, adds GST and collects payment. The only module that talks to
// Stripe; webhooks update invoice status and totals, never access.
@Module({
  imports: [StripeModule, EmailModule],
  controllers: [
    PersonalSubscriptionController,
    BillingAccountsController,
    InvoicesController,
    InvoiceReviewController,
    StripeWebhookController,
    CustomerBillingController,
    PlanOptionsController,
  ],
  providers: [
    PersonalSubscriptionService,
    PersonalInvoiceService,
    BillingAccountsService,
    InvoicesService,
    InvoiceStripeSyncService,
    MonthlyRunService,
    InvoiceReviewService,
    BillingRunWorker,
    InvoiceEmailNotifier,
    StripeWebhookService,
    BillingConfigService,
    PriceBooksService,
    BillingAccountDetailsService,
    SubscriptionsService,
    EnterpriseContractService,
    SeatsService,
    BillingSignUpService,
    AnnualQuoteService,
    ReviewTasksService,
    CustomerBillingService,
    PlanOptionsService,
  ],
  exports: [
    BillingConfigService,
    BillingAccountsService,
    PriceBooksService,
    BillingAccountDetailsService,
    SubscriptionsService,
    EnterpriseContractService,
    SeatsService,
    BillingSignUpService,
    AnnualQuoteService,
    ReviewTasksService,
  ],
})
export class BillingModule {}
