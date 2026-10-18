"use client";

import { listAdminOrganisationsRequest } from "@/lib/api/adminUsersApi";
import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/hooks/useApiResource";
import {
  getOrganisationBrandAccessRequest,
  listKnowledgeBrandsRequest,
  setOrganisationBrandAccessRequest,
} from "@/lib/api/knowledgeBrandsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { Button } from "@/components/ui/button";

export const KnowledgeAccessSection = ({ organisationId }: { organisationId: string }) => {
  const organisations = useApiResource(listAdminOrganisationsRequest, [], "Couldn't load organisation.");
  const brands = useApiResource(listKnowledgeBrandsRequest, [], "Couldn't load brands.");
  const access = useApiResource(
    (token) => getOrganisationBrandAccessRequest(token, organisationId),
    [organisationId],
    "Couldn't load brand access.",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (access.data) setSelected(access.data.brandIds);
  }, [access.data]);
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await setOrganisationBrandAccessRequest(requireAccessToken(), organisationId, selected);
      setMessage("Knowledge access saved.");
      access.reload();
    } catch (error) {
      setMessage(toApiErrorMessage(error, "Couldn't save access."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex max-w-2xl flex-col gap-4 rounded-xl border border-borderGray p-5">
      <h2 className="text-lg font-medium text-ink">
        {organisations.data?.find((organisation) => organisation.id === organisationId)?.name ?? "Organisation"} —
        Knowledge access
      </h2>
      <p className="text-sm text-bodyGray">
        Choose the brands this organisation can browse, search and use in AI answers.
      </p>
      {(brands.error || access.error) && (
        <p role="alert" className="text-sm text-danger">
          {brands.error || access.error}
        </p>
      )}
      {brands.isLoading || access.isLoading ? (
        <p className="text-sm text-mutedGray">Loading access…</p>
      ) : (
        (brands.data ?? []).map((brand) => (
          <label key={brand.id} className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              disabled={busy}
              checked={selected.includes(brand.id)}
              onChange={(event) =>
                setSelected(event.target.checked ? [...selected, brand.id] : selected.filter((id) => id !== brand.id))
              }
            />
            {brand.name}
            {!brand.isActive && <span className="text-xs text-mutedGray">Inactive</span>}
          </label>
        ))
      )}
      {message && (
        <p role="status" className="text-sm text-bodyGray">
          {message}
        </p>
      )}
      <Button
        variant="primary"
        className="w-fit"
        disabled={busy || access.isLoading || brands.isLoading || !!access.error || !!brands.error}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Save access"}
      </Button>
    </section>
  );
};
