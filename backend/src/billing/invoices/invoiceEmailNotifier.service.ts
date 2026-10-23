import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { escapeHtml } from '../../common/utils/escapeHtml';
import { formatCents } from './formatCents';
import { InvoiceSummary } from './types/invoiceResponse';

// FIELD sends the invoice email itself, linking to Stripe's hosted invoice
// page (Stripe's own invoice emails stay off: we never call sendInvoice).
// A failed email is logged, never undoes the invoice.
@Injectable()
export class InvoiceEmailNotifier {
  private readonly logger = new Logger(InvoiceEmailNotifier.name);

  constructor(private readonly emailService: EmailService) {}

  sendInvoiceReady = async (
    invoice: InvoiceSummary,
    billingEmail: string,
  ): Promise<void> => {
    if (!invoice.hostedInvoiceUrl || invoice.totalCents === null) return;
    if (!this.emailService.isConfigured) {
      this.logger.warn(
        `Email isn't set up; invoice ${invoice.id} not emailed.`,
      );
      return;
    }
    const total = formatCents(invoice.totalCents, invoice.currency);
    const link = invoice.hostedInvoiceUrl;
    try {
      await this.emailService.sendEmail({
        to: billingEmail,
        subject: `Your QuipTech FIELD invoice — ${total} due`,
        text: `Hello ${invoice.billingAccountName},\n\nYour QuipTech FIELD invoice for ${total} (incl. GST) is ready. View and pay it here:\n${link}\n\nQuipTech FIELD`,
        html: `<p>Hello ${escapeHtml(invoice.billingAccountName)},</p>
<p>Your QuipTech FIELD invoice for <strong>${escapeHtml(total)}</strong> (incl. GST) is ready.</p>
<p><a href="${escapeHtml(link)}">View and pay your invoice</a></p>
<p>QuipTech FIELD</p>`,
      });
    } catch (error) {
      this.logger.warn(`Invoice ${invoice.id} email failed: ${String(error)}`);
    }
  };
}
