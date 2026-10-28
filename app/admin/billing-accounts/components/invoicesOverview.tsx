"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/statCard";
import { Table, TableCell, TableHeaderCell, TableHeaderRow, TableRow } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { Icon } from "@/components/icons/icon";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { listAdminInvoicesRequest, refreshInvoicesFromStripeRequest } from "@/lib/api/adminInvoicesApi";
import { getInitials } from "@/lib/format/nameInitials";
import { audMoney } from "@/lib/format/audMoney";
import { ADMIN_INVOICE_CATEGORIES, type AdminInvoice, type AdminInvoiceCategory } from "@/lib/types/adminInvoice";
import { INVOICE_CATEGORY_LABELS } from "../invoiceCategoryLabels";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/actionMenu";
import { createCreditNoteRequest, holdInvoiceRequest, releaseInvoiceRequest } from "@/lib/api/adminBillingOperationsApi";
import { AdminPromptDialog } from "./adminPromptDialog";

type InvoiceAction = { invoice: AdminInvoice; action: "credit" | "hold" };

const CREDITABLE = ["synced", "paid", "payment_failed"];

const actionsFor = (
  invoice: AdminInvoice,
  start: (action: InvoiceAction) => void,
  release: (invoice: AdminInvoice) => void,
): ActionMenuItem[] => {
  const items: ActionMenuItem[] = [];
  const creditable = (invoice.totalCents ?? 0) - invoice.amountCreditedCents;
  if (invoice.stripeInvoiceId && CREDITABLE.includes(invoice.status) && creditable > 0)
    items.push({ label: "Issue credit note", icon: "file", onSelect: () => start({ invoice, action: "credit" }) });
  if (invoice.invoiceKind === "monthly" && invoice.status === "draft")
    items.push(
      invoice.heldAt
        ? { label: "Release for sending", icon: "send", onSelect: () => release(invoice) }
        : { label: "Hold for review", icon: "clock", onSelect: () => start({ invoice, action: "hold" }) },
    );
  return items;
};

const PAGE_SIZE = 25;
const SEARCH_DELAY_MS = 300;

const formatMonth = (periodStart: string | null) =>
  periodStart
    ? new Date(`${periodStart}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "—";

// Stripe adds GST when the invoice is finalised; until then only the ex-GST amount is known.
const formatTotal = (invoice: AdminInvoice) =>
  invoice.totalCents === null ? `${audMoney(invoice.totalExGstCents)} + GST` : audMoney(invoice.totalCents);

const InvoiceRow = ({ invoice, actions }: { invoice: AdminInvoice; actions: ActionMenuItem[] }) => {
  const category = INVOICE_CATEGORY_LABELS[invoice.category];
  const payer = invoice.kind === "personal" ? invoice.payerName ?? invoice.payerEmail ?? "Unknown user" : invoice.organisationName;
  return (
    <TableRow>
      <TableCell flex={2} className="flex items-center gap-2.5">
        <Avatar initials={getInitials(payer)} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{payer}</span>
          <span className="block truncate text-xs text-mutedGray">
            {invoice.kind === "personal" ? invoice.payerEmail : "Organisation invoice"}
          </span>
        </span>
      </TableCell>
      <TableCell flex={1.4} className="truncate text-bodyGray">{invoice.organisationName}</TableCell>
      <TableCell className="text-bodyGray">{formatMonth(invoice.periodStart)}</TableCell>
      <TableCell className="flex flex-col text-ink">
        {formatTotal(invoice)}
        {invoice.amountCreditedCents > 0 && (
          <span className="text-xs text-mutedGray">{audMoney(invoice.amountCreditedCents)} credited</span>
        )}
      </TableCell>
      <TableCell className="text-bodyGray">{audMoney(invoice.amountPaidCents - invoice.amountRefundedCents)}</TableCell>
      <TableCell className="flex flex-wrap items-center gap-1">
        <span title={category.hint}><Tag tone={category.tone}>{category.label}</Tag></span>
        {invoice.heldAt && <Tag tone="amber">Held</Tag>}
      </TableCell>
      <TableCell className="text-sm">
        {invoice.hostedInvoiceUrl ? (
          <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
            Stripe <Icon name="ext" className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-mutedGray">—</span>
        )}
      </TableCell>
      <TableCell flex={0.4}>
        {actions.length > 0 && <ActionMenu label={`Actions for invoice ${invoice.id}`} items={actions} />}
      </TableCell>
    </TableRow>
  );
};

export const InvoicesOverview = () => {
  const [category, setCategory] = useState<AdminInvoiceCategory | "">("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [acting, setActing] = useState<InvoiceAction | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);


  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchText.trim()); setPage(1); }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const list = useApiResource(
    (accessToken) => listAdminInvoicesRequest(accessToken, { category: category || undefined, search: search || undefined, page, pageSize: PAGE_SIZE }),
    [category, search, page],
    "Couldn't load invoices. Please try again.",
  );
  const summary = list.data?.summary;
  const release = async (invoice: AdminInvoice) => {
    setActionMessage(null);
    try {
      await releaseInvoiceRequest(requireAccessToken(), invoice.id);
      setActionMessage("Released. It goes to Stripe on the next hourly run.");
      list.reload();
    } catch (error) {
      setActionMessage(toApiErrorMessage(error, "Couldn't release the invoice."));
    }
  };

  const refreshFromStripe = async () => {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const result = await refreshInvoicesFromStripeRequest(requireAccessToken());
      setRefreshMessage(
        result.checked === 0
          ? "Every invoice is up to date. Nothing is waiting on Stripe."
          : `Checked ${result.checked} unpaid invoice${result.checked === 1 ? "" : "s"} with Stripe: ${result.updated} newly paid` +
            (result.failed ? `, ${result.failed} couldn't be checked (see the API log).` : "."),
      );
      list.reload();
    } catch (error) {
      setRefreshMessage(toApiErrorMessage(error, "Couldn't reach Stripe. Please try again."));
    } finally {
      setRefreshing(false);
    }
  };

  const chooseCategory = (next: AdminInvoiceCategory | "") => { setCategory(next); setPage(1); };
  const allCount = summary ? ADMIN_INVOICE_CATEGORIES.reduce((sum, key) => sum + summary[key].count, 0) : null;

  return (
    <div className="flex flex-col gap-3.5">
      {summary && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard
            label="Collected"
            value={audMoney(summary.paid.paidCents + summary.refunded.paidCents)}
            caption={`${summary.paid.count} paid invoice${summary.paid.count === 1 ? "" : "s"}`}
            icon="check"
            tone="primary"
          />
          <StatCard
            label="Outstanding"
            value={audMoney(summary.unpaid.totalCents + summary.failed.totalCents)}
            caption={`${summary.unpaid.count} unpaid · ${summary.failed.count} failed`}
            icon="alert"
            tone={summary.failed.count > 0 ? "danger" : "amber"}
          />
          <StatCard
            label="Pending"
            value={String(summary.pending.count)}
            caption="Not on Stripe yet or payment in progress"
            icon="clock"
            tone="default"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by payment status">
          {[{ value: "" as const, label: "All", tone: "default" as const, count: allCount }, ...ADMIN_INVOICE_CATEGORIES.map((key) => ({
            value: key, label: INVOICE_CATEGORY_LABELS[key].label, tone: INVOICE_CATEGORY_LABELS[key].tone, count: summary?.[key].count ?? null,
          }))].map((chip) => {
            const isSelected = chip.value === category;
            if (chip.value && !chip.count && !isSelected) return null;
            return (
              <button key={chip.value || "all"} type="button" aria-pressed={isSelected} onClick={() => chooseCategory(chip.value)}>
                <Tag tone={isSelected ? "primary" : chip.tone} className={isSelected ? "ring-1 ring-primary" : ""}>
                  {chip.label}{chip.count !== null ? ` · ${chip.count}` : ""}
                </Tag>
              </button>
            );
          })}
        </div>
        <Input
          icon="search"
          className="ml-auto w-full sm:w-64"
          placeholder="Search user, email or organisation"
          aria-label="Search invoices"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <Button onClick={() => void refreshFromStripe()} disabled={refreshing}>
          {refreshing ? <LoadingSpinner /> : <Icon name="history" className="h-4 w-4" />}
          {refreshing ? "Checking Stripe…" : "Refresh from Stripe"}
        </Button>
      </div>
      {refreshMessage && <p role="status" className="text-sm text-bodyGray">{refreshMessage}</p>}

      {list.isLoading && !list.data && (
        <span className="flex items-center gap-2 p-10 text-sm text-mutedGray"><LoadingSpinner /> Loading invoices…</span>
      )}
      {list.error && <span className="text-sm text-danger">{list.error}</span>}
      {list.data && (
        <Table>
          <TableHeaderRow>
            <TableHeaderCell flex={2}>Billed to</TableHeaderCell>
            <TableHeaderCell flex={1.4}>Organisation</TableHeaderCell>
            <TableHeaderCell>Month</TableHeaderCell>
            <TableHeaderCell>Total</TableHeaderCell>
            <TableHeaderCell>Paid</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Invoice</TableHeaderCell>
            <TableHeaderCell flex={0.4}> </TableHeaderCell>
          </TableHeaderRow>
          {list.data.items.length === 0 && (
            <div className="px-4 py-6 text-sm text-mutedGray">
              {category || search ? "No invoices match these filters." : "No invoices yet."}
            </div>
          )}
          {list.data.items.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} actions={actionsFor(invoice, setActing, (item) => void release(item))} />
          ))}
        </Table>
      )}
      {list.data && <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPageChange={setPage} />}
      {actionMessage && <p role="status" className="text-sm text-bodyGray">{actionMessage}</p>}
      {acting?.action === "credit" && (
        <AdminPromptDialog
          title="Issue a credit note"
          description={`Credits part or all of this invoice on Stripe (GST included): refunded if it was paid, otherwise taken off what is owed. Up to ${audMoney((acting.invoice.totalCents ?? 0) - acting.invoice.amountCreditedCents)} can be credited.`}
          confirmLabel="Issue credit note"
          fields={[
            { name: "amount", label: "Amount (A$, incl. GST)", type: "money" },
            { name: "reason", label: "Reason (shown on the credit note)" },
          ]}
          onConfirm={async ({ amount, reason }) => {
            await createCreditNoteRequest(requireAccessToken(), acting.invoice.id, { amountCents: Number(amount), reason: String(reason) });
            setActing(null);
            setActionMessage("Credit note issued on Stripe.");
            list.reload();
          }}
          onClose={() => setActing(null)}
        />
      )}
      {acting?.action === "hold" && (
        <AdminPromptDialog
          title="Hold this invoice"
          description="It won't be finalised or sent to Stripe until you release it."
          confirmLabel="Hold invoice"
          fields={[{ name: "reason", label: "Reason (audit log)" }]}
          onConfirm={async ({ reason }) => {
            await holdInvoiceRequest(requireAccessToken(), acting.invoice.id, String(reason));
            setActing(null);
            list.reload();
          }}
          onClose={() => setActing(null)}
        />
      )}
    </div>
  );
};
