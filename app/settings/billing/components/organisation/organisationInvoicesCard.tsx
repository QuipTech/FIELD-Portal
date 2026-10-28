"use client";

import { useState } from "react";
import { Tag } from "@/components/ui/tag";
import type { Tone } from "@/components/ui/tone";
import { getOrganisationInvoicePdfRequest } from "@/lib/api/organisationBillingApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { audMoney } from "@/lib/format/audMoney";
import { formatBillingDay, formatBillingMonth } from "@/lib/format/billingDay";
import type { OrganisationInvoice } from "@/lib/types/organisationBilling";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "ok" },
  synced: { label: "Due", tone: "amber" },
  payment_failed: { label: "Payment failed", tone: "danger" },
  void: { label: "Void", tone: "default" },
  draft: { label: "Being prepared", tone: "primary" },
  final: { label: "Being prepared", tone: "primary" },
};

const describe = (invoice: OrganisationInvoice) =>
  invoice.periodStart ? formatBillingMonth(invoice.periodStart) : formatBillingDay(invoice.createdAt);

// The organisation's invoices, newest first, with Stripe's PDF and pay link.
export const OrganisationInvoicesCard = ({ invoices }: { invoices: OrganisationInvoice[] }) => {
  const [error, setError] = useState<string | null>(null);
  const openPdf = async (invoiceId: string) => {
    setError(null);
    try {
      const { url } = await getOrganisationInvoicePdfRequest(requireAccessToken(), invoiceId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(toApiErrorMessage(cause, "Couldn't open the PDF. Please try again."));
    }
  };
  return (
    <section className="overflow-hidden rounded-xl border border-borderGray bg-surface">
      <h2 className="border-b border-borderGray p-4 font-medium text-ink">Organisation invoices</h2>
      {error && <p role="alert" className="px-4 pt-3 text-sm text-danger">{error}</p>}
      {invoices.length === 0 ? (
        <p className="p-4 text-sm text-bodyGray">No invoices yet. The first one arrives on the 1st after you activate a machine.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surfaceGray text-bodyGray">
              <tr>{["Invoice", "Status", "Total", "Paid", ""].map((label) => <th key={label} className="p-3 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const status = STATUS[invoice.status] ?? { label: invoice.status, tone: "default" as const };
                return (
                  <tr key={invoice.id} className="border-t border-borderGray text-ink">
                    <td className="p-3">{describe(invoice)}</td>
                    <td className="p-3"><Tag tone={status.tone}>{status.label}</Tag></td>
                    <td className="p-3">{invoice.totalCents === null ? "Pending" : audMoney(invoice.totalCents)}</td>
                    <td className="p-3 text-bodyGray">{audMoney(invoice.amountPaidCents)}</td>
                    <td className="flex gap-3 p-3">
                      {invoice.hostedInvoiceUrl && invoice.status !== "paid" && (
                        <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Pay</a>
                      )}
                      {invoice.hasPdf && (
                        <button type="button" className="text-primary underline" onClick={() => void openPdf(invoice.id)}>PDF</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
