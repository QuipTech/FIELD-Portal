import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { StripeModule } from './stripe/stripe.module';
import { BillingAccountsController } from './billingAccounts/billingAccounts.controller';
import { BillingAccountsService } from './billingAccounts/billingAccounts.service';
import { InvoicesController } from './invoices/invoices.controller';
import { InvoicesService } from './invoices/invoices.service';
import { InvoiceStripeSyncService } from './invoices/invoiceStripeSync.service';
import { InvoicePaymentSheetService } from './invoices/invoicePaymentSheet.service';
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
import { PersonalPaymentCheckService } from './personalSubscription/personalPaymentCheck.service';
import { PersonalCheckoutService } from './personalSubscription/personalCheckout.service';
import { AdminInvoicesController } from './adminInvoices/adminInvoices.controller';
import { AdminInvoicesService } from './adminInvoices/adminInvoices.service';

// FIELD-calculated invoicing: FIELD owns every amount, Stripe presents the
// invoice, adds GST and collects payment. The only module that talks to
// Stripe; webhooks update invoice status and totals, never access.
import { OrganisationPlanController } from './customerBilling/organisationPlan.controller';
import { OrganisationPlanService } from './customerBilling/organisationPlan.service';
import { AdminBillingOperationsController } from './billingOperations/adminBillingOperations.controller';
import { AccountSuspensionService } from './collections/accountSuspension.service';
import { CreditNotesService } from './collections/creditNotes.service';
import { OverdueService } from './collections/overdue.service';
import { OnboardingService } from './onboarding/onboarding.service';
import { BillingSettingsService } from './billingSettings/billingSettings.service';
import { BillingNotifier } from './billingNotices/billingNotifier.service';
import { AllowanceService } from './allowance/allowance.service';
import { UpFrontInvoiceService } from './invoices/upFrontInvoice.service';
import { SubscriptionRenewalService } from './subscriptions/subscriptionRenewal.service';
import { AccountTermsService } from './accountTerms/accountTerms.service';
import { FreePeriodService } from './accountTerms/freePeriod.service';
import { OrganisationPaymentTermsController } from './accountTerms/organisationPaymentTerms.controller';
import { AdminPaymentTermsController } from './accountTerms/adminPaymentTerms.controller';
import { DiscountService } from './discounts/discount.service';
import { PromoCodesService } from './discounts/promoCodes.service';
import { OverdueListService } from './collections/overdueList.service';
import { MarkInvoicePaidService } from './invoices/markInvoicePaid.service';

@Module({
  imports: [StripeModule, EmailModule],
  controllers: [
    PersonalSubscriptionController,
    BillingAccountsController,
    InvoicesController,
    AdminInvoicesController,
    InvoiceReviewController,
    StripeWebhookController,
    CustomerBillingController,
    PlanOptionsController,
    OrganisationPlanController,
    AdminBillingOperationsController,
    OrganisationPaymentTermsController,
    AdminPaymentTermsController,
  ],
  providers: [
    PersonalSubscriptionService,
    PersonalInvoiceService,
    PersonalPaymentCheckService,
    PersonalCheckoutService,
    AdminInvoicesService,
    BillingAccountsService,
    InvoicesService,
    InvoiceStripeSyncService,
    InvoicePaymentSheetService,
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
    OrganisationPlanService,
    AccountSuspensionService,
    CreditNotesService,
    OverdueService,
    OnboardingService,
    BillingSettingsService,
    BillingNotifier,
    AllowanceService,
    UpFrontInvoiceService,
    SubscriptionRenewalService,
    AccountTermsService,
    FreePeriodService,
    DiscountService,
    PromoCodesService,
    OverdueListService,
    MarkInvoicePaidService,
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
    UpFrontInvoiceService,
    DiscountService,
    PromoCodesService,
  ],
})
export class BillingModule {}
