"use client";
import Link from "next/link";
import { useApiResource } from "@/lib/hooks/useApiResource";
import { listAdminOrganisationsRequest } from "@/lib/api/adminUsersApi";
export const OrganisationDirectory = () => {
  const organisations = useApiResource(listAdminOrganisationsRequest, [], "Couldn't load organisations.");
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      {organisations.error && <p className="text-danger">{organisations.error}</p>}
      {organisations.isLoading && <p className="text-mutedGray">Loading organisations…</p>}
      {(organisations.data ?? []).map((organisation) => (
        <Link
          key={organisation.id}
          href={`/admin/organisations/${organisation.id}`}
          className="rounded-lg border border-borderGray p-4 text-ink hover:bg-primaryTint"
        >
          {organisation.name}
          <span className="float-right text-sm text-primary">Knowledge access →</span>
        </Link>
      ))}
    </div>
  );
};
