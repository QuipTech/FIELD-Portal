"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Tag } from "@/components/ui/tag";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { listBillingConfigRequest, listPriceBooksRequest, updateBillingConfigRequest } from "@/lib/api/adminBillingOperationsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { audMoney } from "@/lib/format/audMoney";
import { formatBillingDay } from "@/lib/format/billingDay";
import type { BillingConfigEntry, PriceBook } from "@/lib/types/adminBillingOperations";
import { NewPriceBookDialog } from "./newPriceBookDialog";

const PRICE_UNITS: Record<string, string> = {
  ASSET_PRO: "per active machine per month",
  TECH: "per user per month",
  REMOTE_SESSION: "per 15 minutes or part",
  ONBOARD_ASSISTED: "per site, one-off",
  ENTERPRISE: "annual minimum",
  INTERNAL: "never invoiced",
};

const describePrice = (book: PriceBook) => {
  if (book.bands.length)
    return book.bands.map((band) => `${band.upperQty === null ? `${band.lowerQty}+` : `${band.lowerQty}–${band.upperQty}`}: ${audMoney(band.unitCents)}`).join(" · ");
  if (book.planCode === "ENTERPRISE") return book.minimumAnnualCents === null ? "Quoted" : `Quoted, minimum ${audMoney(book.minimumAnnualCents)} a year`;
  return book.unitCents === null ? "—" : audMoney(book.unitCents);
};

const parseConfigValue = (entry: BillingConfigEntry, text: string): number | string | null | undefined => {
  if (entry.kind === "timeZone") return text.trim() || undefined;
  if (entry.kind === "optionalPositiveNumber" && !text.trim()) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
};

const PriceBooks = () => {
  const books = useApiResource(listPriceBooksRequest, [], "Couldn't load prices.");
  const [editing, setEditing] = useState<PriceBook | null>(null);
  const plans = Array.from(new Set((books.data ?? []).map((book) => book.planCode))).filter((code) => code !== "INTERNAL");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium text-ink">Prices</h2>
      <p className="text-sm text-bodyGray">
        Remote sessions and partner billing aren&apos;t live yet; their prices are kept here and in the settings below ready
        for when they are.
      </p>
      {books.isLoading && !books.data && <span className="flex items-center gap-2 text-sm text-mutedGray"><LoadingSpinner /> Loading…</span>}
      {books.error && <p className="text-sm text-danger">{books.error}</p>}
      {plans.map((planCode) => {
        const versions = (books.data ?? []).filter((book) => book.planCode === planCode);
        const inEffect = versions.find((book) => book.isInEffect) ?? versions[versions.length - 1];
        const upcoming = versions.filter((book) => book.version > inEffect.version);
        return (
          <article key={planCode} className="flex flex-col gap-1 rounded-xl border border-borderGray bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{inEffect.planName}</span>
              <Tag>v{inEffect.version}</Tag>
              <span className="text-xs text-mutedGray">{PRICE_UNITS[planCode]} · {inEffect.subscriptionCount} subscriptions pinned</span>
              <Button size="sm" className="ml-auto" onClick={() => setEditing(inEffect)}>New prices</Button>
            </div>
            <span className="text-sm text-bodyGray">{describePrice(inEffect)}</span>
            {upcoming.map((book) => (
              <span key={book.id} className="text-sm text-primaryTintText">
                v{book.version} from {formatBillingDay(book.effectiveFrom)}: {describePrice(book)}
              </span>
            ))}
          </article>
        );
      })}
      {editing && (
        <NewPriceBookDialog current={editing} onSaved={() => { setEditing(null); books.reload(); }} onClose={() => setEditing(null)} />
      )}
    </section>
  );
};

const ConfigRow = ({ entry, onSaved }: { entry: BillingConfigEntry; onSaved: () => void }) => {
  const [text, setText] = useState(entry.value === null ? "" : String(entry.value));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isChanged = text !== (entry.value === null ? "" : String(entry.value));
  const save = async () => {
    const value = parseConfigValue(entry, text);
    if (value === undefined) { setError("Enter a valid value."); return; }
    setIsSaving(true);
    setError(null);
    try {
      await updateBillingConfigRequest(requireAccessToken(), entry.key, value);
      onSaved();
    } catch (cause) {
      setError(toApiErrorMessage(cause, "Couldn't save."));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <tr className="border-t border-borderGray align-top">
      <td className="p-2">
        <span className="font-mono text-xs text-ink">{entry.key}</span>
        {!entry.isFinal && <Tag tone="amber" className="ml-2">Not final</Tag>}
        <p className="text-xs text-bodyGray">{entry.description}</p>
      </td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <input aria-label={entry.key} value={text} onChange={(event) => setText(event.target.value)} className="h-9 w-40 rounded-lg border border-borderGrayStrong bg-surface px-2 text-sm text-ink" placeholder={entry.kind === "optionalPositiveNumber" ? "off" : undefined} />
          {isChanged && <Button size="sm" variant="primary" disabled={isSaving} onClick={() => void save()}>Save</Button>}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
};

const Settings = () => {
  const config = useApiResource(listBillingConfigRequest, [], "Couldn't load billing settings.");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium text-ink">Settings</h2>
      <p className="text-sm text-bodyGray">Used from the next billing run; no deploy needed. Every change is audit-logged.</p>
      {config.error && <p className="text-sm text-danger">{config.error}</p>}
      {config.data && (
        <div className="overflow-x-auto rounded-xl border border-borderGray bg-surface">
          <table className="w-full text-left text-sm">
            <tbody>
              {config.data.map((entry) => <ConfigRow key={`${entry.key}:${entry.updatedAt}`} entry={entry} onSaved={config.reload} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// Spec section 11: prices (versioned price books) and billing settings,
// editable without a deploy.
export const PricesAndSettingsPanel = () => (
  <div className="flex flex-col gap-5">
    <PriceBooks />
    <Settings />
  </div>
);
