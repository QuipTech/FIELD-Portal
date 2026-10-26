"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirmDialog";
import { createPriceBookRequest } from "@/lib/api/adminBillingOperationsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { PriceBook } from "@/lib/types/adminBillingOperations";

interface NewPriceBookDialogProps {
  // The version in effect, used as the starting point.
  current: PriceBook;
  onSaved: () => void;
  onClose: () => void;
}

const inputClass = "h-9 w-full rounded-lg border border-borderGrayStrong bg-surface px-2 text-sm text-ink outline-none";
const toDollars = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));
const toCents = (dollars: string) => {
  const value = Number(dollars.replace(/[$,\s]/g, ""));
  return dollars.trim() && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
};
const tomorrow = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

// A new version of one plan's prices. It takes effect from its date for new
// sign-ups and renewals; live subscriptions keep the version they pinned
// until they renew (spec T27).
export const NewPriceBookDialog = ({ current, onSaved, onClose }: NewPriceBookDialogProps) => {
  const isBanded = current.bands.length > 0;
  const [effectiveFrom, setEffectiveFrom] = useState(tomorrow());
  const [unit, setUnit] = useState(toDollars(current.unitCents));
  const [minimum, setMinimum] = useState(toDollars(current.minimumAnnualCents));
  const [bands, setBands] = useState(
    current.bands.map((band) => ({ lowerQty: String(band.lowerQty), upperQty: band.upperQty === null ? "" : String(band.upperQty), rate: toDollars(band.unitCents) })),
  );
  const updateBand = (index: number, field: "lowerQty" | "upperQty" | "rate", value: string) =>
    setBands((rows) => rows.map((row, at) => (at === index ? { ...row, [field]: value } : row)));

  const save = async () => {
    await createPriceBookRequest(requireAccessToken(), {
      planCode: current.planCode,
      effectiveFrom,
      unitCents: isBanded ? null : toCents(unit),
      minimumAnnualCents: current.planCode === "ENTERPRISE" ? toCents(minimum) : null,
      bands: isBanded
        ? bands.map((band) => ({
            lowerQty: Number(band.lowerQty),
            upperQty: band.upperQty.trim() ? Number(band.upperQty) : null,
            unitCents: toCents(band.rate) ?? -1,
          }))
        : [],
    });
    onSaved();
  };

  return (
    <ConfirmDialog
      title={`New ${current.planName} prices`}
      confirmLabel={`Save version ${current.version + 1}`}
      confirmVariant="primary"
      onConfirm={save}
      onClose={onClose}
      toErrorMessage={(error) => toApiErrorMessage(error, "Couldn't save the prices.")}
    >
      <div className="flex flex-col gap-3">
        <p>All prices are AUD, ex GST. Customers already on a plan keep their current prices until their next renewal.</p>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Takes effect from
          <input type="date" value={effectiveFrom} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setEffectiveFrom(event.target.value)} className={inputClass} />
        </label>
        {isBanded ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-mutedGray"><tr><th className="pb-1">From</th><th className="pb-1">To (blank = no limit)</th><th className="pb-1">A$ per machine</th></tr></thead>
            <tbody>
              {bands.map((band, index) => (
                <tr key={index}>
                  <td className="pr-2 pb-1"><input aria-label={`Band ${index + 1} from`} value={band.lowerQty} onChange={(event) => updateBand(index, "lowerQty", event.target.value)} className={inputClass} /></td>
                  <td className="pr-2 pb-1"><input aria-label={`Band ${index + 1} to`} value={band.upperQty} onChange={(event) => updateBand(index, "upperQty", event.target.value)} className={inputClass} /></td>
                  <td className="pb-1"><input aria-label={`Band ${index + 1} rate`} value={band.rate} onChange={(event) => updateBand(index, "rate", event.target.value)} className={inputClass} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : current.planCode === "ENTERPRISE" ? (
          <label className="flex flex-col gap-1 text-sm text-ink">
            Annual minimum (A$)
            <input value={minimum} onChange={(event) => setMinimum(event.target.value)} className={inputClass} />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm text-ink">
            Price (A$)
            <input value={unit} onChange={(event) => setUnit(event.target.value)} className={inputClass} />
          </label>
        )}
      </div>
    </ConfirmDialog>
  );
};
