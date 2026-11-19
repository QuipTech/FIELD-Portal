"use client";

import { Tag } from "@/components/ui/tag";
import type { Tone } from "@/components/ui/tone";
import { audMoney } from "@/lib/format/audMoney";
import { formatBillingDay, formatBillingMonth } from "@/lib/format/billingDay";
import type { OrganisationStatement } from "@/lib/types/billingStatement";

const describeStatus = (statement: OrganisationStatement): { label: string; tone: Tone } => {
  if (statement.overdue) return { label: "Overdue", tone: "danger" };
  switch (statement.status) {
    case "ready":
      return { label: "Being invoiced", tone: "primary" };
    case "invoiced_external":
      return { label: "Invoiced", tone: "amber" };
    case "paid":
      return { label: "Paid", tone: "ok" };
    default:
      return { label: "Being prepared", tone: "primary" };
  }
};

// A 30-day account's monthly statements. QuipTech accounts invoices each one
// from Zoho and emails it; nothing is paid in FIELD.
export const OrganisationStatementsCard = ({ statements }: { statements: OrganisationStatement[] }) => (
  <section className="overflow-hidden rounded-xl border border-borderGray bg-surface">
    <div className="border-b border-borderGray p-4">
      <h2 className="font-medium text-ink">Monthly statements</h2>
      <p className="text-sm text-bodyGray">
        Your invoice for each month is emailed by QuipTech accounts. Contact them about payments or questions.
      </p>
    </div>
    {statements.length === 0 ? (
      <p className="p-4 text-sm text-bodyGray">No statements yet. The first one is prepared after the month you activate a machine.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surfaceGray text-bodyGray">
            <tr>
              {["Month", "Status", "Invoice", "Due", "Total inc GST"].map((label) => (
                <th key={label} className="p-3 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statements.map((statement) => {
              const status = describeStatus(statement);
              return (
                <tr key={statement.id} className="border-t border-borderGray align-top text-ink">
                  <td className="p-3">
                    {formatBillingMonth(statement.billingMonth)}
                    <span className="block text-xs text-bodyGray">{statement.reference}</span>
                  </td>
                  <td className="p-3"><Tag tone={status.tone}>{status.label}</Tag></td>
                  <td className="p-3 text-bodyGray">
                    {statement.zohoInvoiceNumber ?? "—"}
                    {statement.zohoInvoiceDate && <span className="block text-xs">{formatBillingDay(statement.zohoInvoiceDate)}</span>}
                  </td>
                  <td className="p-3 text-bodyGray">
                    {statement.paidOn ? `Paid ${formatBillingDay(statement.paidOn)}` : statement.dueOn ? formatBillingDay(statement.dueOn) : "—"}
                  </td>
                  <td className="p-3">
                    {audMoney(statement.totalIncGstCents)}
                    <span className="block text-xs text-bodyGray">{audMoney(statement.subtotalExGstCents)} + GST</span>
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
