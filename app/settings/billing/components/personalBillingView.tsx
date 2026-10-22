"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePersonalBilling } from "@/lib/hooks/usePersonalBilling";
import { getPersonalInvoices } from "@/lib/api/personalBillingApi";
import { getAccessToken } from "@/lib/auth/authSession";
import { audMoney } from "@/lib/format/audMoney";
import type { PersonalInvoice } from "@/lib/types/personalBilling";
import { Button } from "@/components/ui/button";
import { PersonalPaymentDialog } from "@/components/billing/personalPaymentDialog";

export const PersonalBillingView = () => {
  const { status, error, loading, refresh } = usePersonalBilling();
  const [showPayment, setShowPayment] = useState(false);
  const [invoices, setInvoices] = useState<PersonalInvoice[] | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    let live = true;
    getPersonalInvoices(token).then((items) => {
      if (live) { setInvoices(items); setInvoiceError(null); }
    }).catch((cause) => {
      if (live) setInvoiceError(cause instanceof Error ? cause.message : "Unable to load invoices.");
    });
    return () => { live = false; };
  }, [status?.invoiceStatus, reload]);

  return (
    <>
      <h1 className="text-[22px] font-medium text-ink">Billing &amp; subscription</h1>
      {loading && <div role="status" className="h-36 animate-pulse rounded-xl bg-surface">Loading subscription…</div>}
      {error && <div role="alert" className="rounded-xl border border-borderGray bg-surface p-5"><p>{error}</p><Button onClick={() => void refresh()}>Try again</Button></div>}
      {status && (
        <section className="rounded-xl border border-borderGray bg-surface p-5">
          <h2 className="text-lg font-medium text-ink">{status.exempt ? "Owner account" : "FIELD Technician"}</h2>
          {status.exempt ? <p className="mt-2 text-bodyGray">Owners are exempt from the personal monthly subscription. <Link href="/admin/subscriptions" className="text-primary underline">Manage organisation subscriptions</Link></p> : <>
            <p className="mt-2 text-2xl font-medium text-ink">{audMoney(status.monthlyCents)} <span className="text-sm font-normal text-bodyGray">per month ex GST</span></p>
            <p className="mt-2 text-sm text-bodyGray">Billing month: {status.periodStart} to the day before {status.periodEnd} · {status.timezone}</p>
            <p className="mt-2 text-sm text-bodyGray">Status: {status.paymentRequired ? "Payment required" : status.coveredByOrganisation ? "Paid by your organisation this month" : "Paid for this month"}</p>
            {status.gstCents !== null && <p className="mt-2 text-sm text-bodyGray">GST: {audMoney(status.gstCents)} · Total: {status.totalCents === null ? "Pending" : audMoney(status.totalCents)}</p>}
            {status.paymentRequired && <Button className="mt-4" onClick={() => setShowPayment(true)}>Review and pay</Button>}
            <p className="mt-3 text-xs text-bodyGray">Your subscription is individual, including when your organisation already pays. Payments are made through Stripe. Automatic monthly charging is not enabled; the next calendar month needs a new payment. No trial or part-month discount applies.</p>
          </>}
        </section>
      )}
      <section className="overflow-hidden rounded-xl border border-borderGray bg-surface">
        <h2 className="border-b border-borderGray p-4 font-medium text-ink">Your invoices</h2>
        {invoiceError ? <div role="alert" className="p-4"><p>{invoiceError}</p><Button onClick={() => setReload((value) => value + 1)}>Retry invoices</Button></div> : invoices === null ? <p role="status" className="p-4 text-bodyGray">Loading invoices…</p> : invoices.length === 0 ? <p className="p-4 text-bodyGray">No invoices yet.</p> : <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surfaceGray text-bodyGray"><tr>{["Month", "Status", "Ex GST", "GST", "Total", "Payment"].map((label) => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{invoices.map((invoice) => <tr key={invoice.invoiceId} className="border-t border-borderGray text-ink">
              <td className="p-3">{invoice.periodStart.slice(0, 7)}</td>
              <td className="p-3">{invoice.status.replaceAll("_", " ")}</td>
              <td className="p-3">{audMoney(invoice.totalExGstCents)}</td>
              <td className="p-3">{invoice.gstCents === null ? "Pending" : audMoney(invoice.gstCents)}</td>
              <td className="p-3">{invoice.totalCents === null ? "Pending" : audMoney(invoice.totalCents)}</td>
              <td className="p-3">{invoice.hostedInvoiceUrl && <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">View / pay</a>}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
      {showPayment && status?.paymentRequired && <PersonalPaymentDialog status={status} refresh={refresh} onClose={() => setShowPayment(false)} />}
    </>
  );
};
