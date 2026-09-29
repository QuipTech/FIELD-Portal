"use client";

import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import type { TenantSubscription } from "@/lib/types/tenantSubscription";
import { useSubscriptions } from "../useSubscriptions";
import { SubscriptionStatusFilter } from "./subscriptionStatusFilter";
import { SubscriptionsTable } from "./subscriptionsTable";
import { SubscriptionEditorModal } from "./subscriptionEditorModal";

export const SubscriptionsManager = () => {
  const subscriptions = useSubscriptions();
  const [editing, setEditing] = useState<TenantSubscription | null>(null);
  const { list } = subscriptions;

  return (
    <>
      <div className="flex items-baseline">
        <h1 className="text-[22px] font-medium text-ink">All subscriptions</h1>
        {list && (
          <span className="ml-auto text-xs text-mutedGray">
            {list.total} {list.total === 1 ? "organisation" : "organisations"}
          </span>
        )}
      </div>
      <SubscriptionStatusFilter
        value={subscriptions.status}
        counts={list?.statusCounts ?? null}
        onChange={subscriptions.setStatus}
      />
      {subscriptions.isLoading && !list && (
        <span className="flex items-center gap-2 p-10 text-sm text-mutedGray">
          <LoadingSpinner /> Loading subscriptions…
        </span>
      )}
      {subscriptions.loadError && <span className="text-sm text-danger">{subscriptions.loadError}</span>}
      {list && <SubscriptionsTable items={list.items} onEdit={setEditing} />}
      {list && (
        <p className="px-1 text-xs text-slate-400">Click an organisation to set up or change its subscription.</p>
      )}
      {editing && (
        <SubscriptionEditorModal
          item={editing}
          onSave={subscriptions.saveSubscription}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
};
