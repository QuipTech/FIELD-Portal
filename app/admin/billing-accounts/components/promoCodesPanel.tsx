"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { Modal } from "@/components/ui/modal";
import { Tag } from "@/components/ui/tag";
import { useApiResource } from "@/lib/hooks/useApiResource";
import {
  listPromoCodesRequest,
  listPromoRedemptionsRequest,
  setPromoCodeActiveRequest,
} from "@/lib/api/paymentTermsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { formatBillingDay, formatBillingMonth } from "@/lib/format/billingDay";
import type { PromoCode } from "@/lib/types/paymentTerms";
import { PromoCodeDialog } from "./promoCodeDialog";

const describeValidity = (promo: PromoCode) => {
  const parts = [
    promo.validFrom && `from ${formatBillingDay(promo.validFrom)}`,
    promo.validUntil && `until ${formatBillingDay(promo.validUntil)}`,
  ].filter(Boolean);
  return parts.length ? `Valid ${parts.join(" ")}` : "No expiry";
};

const RedemptionsModal = ({ promo, onClose }: { promo: PromoCode; onClose: () => void }) => {
  const redemptions = useApiResource(
    (token) => listPromoRedemptionsRequest(token, promo.id),
    [promo.id],
    "Couldn't load redemptions.",
  );
  return (
    <Modal title={`${promo.code} redemptions`} onClose={onClose} widthClassName="w-[520px]">
      <div className="flex flex-col gap-2 p-5 text-sm">
        {redemptions.isLoading && !redemptions.data && <span className="flex items-center gap-2 text-mutedGray"><LoadingSpinner /> Loading…</span>}
        {redemptions.error && <p className="text-danger">{redemptions.error}</p>}
        {redemptions.data?.length === 0 && <p className="text-bodyGray">Nobody has used this code yet.</p>}
        {redemptions.data?.map((redemption) => (
          <div key={redemption.id} className="flex flex-wrap items-baseline gap-2 border-b border-borderGray pb-2 last:border-none">
            <span className="font-medium text-ink">{redemption.accountName}</span>
            <span className="text-bodyGray">
              {formatBillingMonth(redemption.startsMonth)}
              {redemption.endsMonth ? ` to ${formatBillingMonth(redemption.endsMonth)}` : " onwards"}
            </span>
            <span className="ml-auto text-xs text-mutedGray">Redeemed {formatBillingDay(redemption.redeemedAt)}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
};

// Promo codes: create, edit, deactivate and see who used them.
export const PromoCodesPanel = () => {
  const promos = useApiResource(listPromoCodesRequest, [], "Couldn't load promo codes.");
  const [editing, setEditing] = useState<PromoCode | "new" | null>(null);
  const [viewing, setViewing] = useState<PromoCode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (promo: PromoCode) => {
    setError(null);
    try {
      await setPromoCodeActiveRequest(requireAccessToken(), promo.id, !promo.active);
      setMessage(`${promo.code} ${promo.active ? "deactivated" : "reactivated"}.`);
      promos.reload();
    } catch (cause) {
      setError(toApiErrorMessage(cause, "Couldn't change the code."));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm text-bodyGray">Codes discount machine charges only, after any free period.</p>
        <Button variant="primary" onClick={() => setEditing("new")}>New promo code</Button>
      </div>
      {message && <p role="status" className="text-sm text-bodyGray">{message}</p>}
      {(error || promos.error) && <p className="text-sm text-danger">{error ?? promos.error}</p>}
      {promos.isLoading && !promos.data && <span className="flex items-center gap-2 text-sm text-mutedGray"><LoadingSpinner /> Loading…</span>}
      {promos.data?.length === 0 && <p className="text-sm text-bodyGray">No promo codes yet.</p>}
      {promos.data?.map((promo) => (
        <article key={promo.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-borderGray bg-surface p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-medium text-ink">{promo.code}</span>
              {promo.active ? <Tag tone="ok">Active</Tag> : <Tag>Inactive</Tag>}
              {promo.newCustomersOnly && <Tag>New customers</Tag>}
            </div>
            <span className="text-sm text-bodyGray">{promo.summary} · {promo.description}</span>
            <span className="text-xs text-mutedGray">
              {describeValidity(promo)} · used {promo.redemptionsCount}
              {promo.maxRedemptions !== null ? ` of ${promo.maxRedemptions}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setViewing(promo)}>Redemptions</Button>
            <Button size="sm" onClick={() => setEditing(promo)}>Edit</Button>
            <Button size="sm" variant={promo.active ? "danger" : "default"} onClick={() => void toggle(promo)}>
              {promo.active ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        </article>
      ))}
      {editing && (
        <PromoCodeDialog
          promo={editing === "new" ? undefined : editing}
          onSaved={(text) => {
            setEditing(null);
            setMessage(text);
            promos.reload();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {viewing && <RedemptionsModal promo={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};
