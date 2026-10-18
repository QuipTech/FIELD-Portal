"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  saveKnowledgeBrandRequest,
  uploadKnowledgeBrandLogoRequest,
  deleteKnowledgeBrandRequest,
} from "@/lib/api/knowledgeBrandsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { KnowledgeBrand, KnowledgeBrandInput } from "@/lib/types/knowledgeBrand";

const EMPTY_BRAND: KnowledgeBrandInput = { name: "", slug: "", description: "", isActive: true, sortOrder: 0 };
export const BrandEditor = ({ brand, onSaved }: { brand: KnowledgeBrand | null; onSaved: () => void }) => {
  const [value, setValue] = useState<KnowledgeBrandInput>(brand ?? EMPTY_BRAND);
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await saveKnowledgeBrandRequest(
        requireAccessToken(),
        {
          name: value.name,
          slug: value.slug,
          description: value.description,
          isActive: value.isActive,
          sortOrder: value.sortOrder,
        },
        brand?.id,
      );
      if (logo) await uploadKnowledgeBrandLogoRequest(requireAccessToken(), saved.id, logo);
      onSaved();
    } catch (failure) {
      setError(toApiErrorMessage(failure, "Couldn't save brand."));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !brand ||
      !window.confirm(`Delete ${brand.name}? Move its documents and remove categories/access grants first.`)
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await deleteKnowledgeBrandRequest(requireAccessToken(), brand.id);
      onSaved();
    } catch (failure) {
      setError(toApiErrorMessage(failure, "Couldn't delete brand."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-xl border border-borderGray p-4">
      <h2 className="font-medium text-ink">{brand ? "Edit brand" : "Create brand"}</h2>
      <label className="text-xs text-bodyGray">
        Name
        <Input
          required
          maxLength={150}
          value={value.name}
          onChange={(event) => setValue({ ...value, name: event.target.value })}
        />
      </label>
      <label className="text-xs text-bodyGray">
        Slug
        <Input
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          value={value.slug}
          onChange={(event) => setValue({ ...value, slug: event.target.value })}
        />
      </label>
      <label className="text-xs text-bodyGray">
        Description
        <Input
          maxLength={5000}
          value={value.description}
          onChange={(event) => setValue({ ...value, description: event.target.value })}
        />
      </label>
      <label className="text-xs text-bodyGray">
        Display order
        <Input
          type="number"
          value={value.sortOrder}
          onChange={(event) => setValue({ ...value, sortOrder: Number(event.target.value) })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-bodyGray">
        <input
          type="checkbox"
          checked={value.isActive}
          onChange={(event) => setValue({ ...value, isActive: event.target.checked })}
        />
        Active
      </label>
      {brand?.logoUrl && (
        <Image
          src={brand.logoUrl}
          alt={`${brand.name} logo`}
          width={64}
          height={64}
          unoptimized
          className="rounded-lg object-contain"
        />
      )}
      <label className="text-xs text-bodyGray">
        Logo (PNG, JPG or SVG, up to 2 MB)
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
          className="mt-1 block w-full"
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save brand"}
        </Button>
        {brand && (
          <Button type="button" disabled={busy} onClick={() => void remove()}>
            Delete brand
          </Button>
        )}
      </div>
    </form>
  );
};
