import type { Tone } from "@/components/ui/tone";
import type { AdminInvoiceCategory } from "@/lib/types/adminInvoice";

export const INVOICE_CATEGORY_LABELS: Record<AdminInvoiceCategory, { label: string; tone: Tone; hint: string }> = {
  paid: { label: "Paid", tone: "ok", hint: "Paid in full on Stripe" },
  unpaid: { label: "Unpaid", tone: "amber", hint: "Sent to Stripe, waiting for payment" },
  failed: { label: "Payment failed", tone: "danger", hint: "Stripe tried to charge and the payment failed" },
  pending: { label: "Pending", tone: "primary", hint: "Not on Stripe yet, or a Checkout payment is in progress" },
  refunded: { label: "Refunded", tone: "default", hint: "Paid, then refunded in part or in full" },
  void: { label: "Void", tone: "default", hint: "Cancelled; nothing is owed" },
};
