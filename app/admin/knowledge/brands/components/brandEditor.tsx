"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/infoHint";
import { LogoPicker } from "./logoPicker";
import {
  saveKnowledgeBrandRequest,
  uploadKnowledgeBrandLogoRequest,
  deleteKnowledgeBrandRequest,
} from "@/lib/api/knowledgeBrandsApi";
import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import { SLUG_HINT, SLUG_PATTERN, toSlug, toSlugWhileTyping } from "@/lib/knowledge/toSlug";
import type { KnowledgeBrand, KnowledgeBrandInput } from "@/lib/types/knowledgeBrand";

const EMPTY_BRAND: KnowledgeBrandInput = { name: "", slug: "", description: "", isActive: true, sortOrder: 0 };
export const BrandEditor = ({ brand, onSaved }: { brand: KnowledgeBrand | null; onSaved: () => void }) => {
  const [value, setValue] = useState<KnowledgeBrandInput>(brand ?? EMPTY_BRAND);
  // A new brand's slug follows its name until someone edits the slug by hand.
  const [slugTouched, setSlugTouched] = useState(Boolean(brand));
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
          slug: toSlug(value.slug),
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
      !window.confirm(`Delete ${brand.name}? Move its documents and remove its categories first.`)
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
          onChange={(event) =>
            setValue({
              ...value,
              name: event.target.value,
              slug: slugTouched ? value.slug : toSlug(event.target.value),
            })
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-bodyGray">
        <span className="flex items-center gap-1">
          Slug
          <InfoHint
            label="About the slug"
            text={`${brand ? "" : "Filled in from the name. "}${SLUG_HINT}`}
          />
        </span>
        <Input
          required
          pattern={SLUG_PATTERN}
          title={SLUG_HINT}
          placeholder="hemisphere-gnss"
          value={value.slug}
          onChange={(event) => {
            setSlugTouched(true);
            setValue({ ...value, slug: toSlugWhileTyping(event.target.value) });
          }}
          onBlur={() => setValue({ ...value, slug: toSlug(value.slug) })}
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
        <span className="flex items-center gap-1">
          Display order
          <InfoHint label="About display order" text="Brands are listed by this number, lowest first." />
        </span>
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
      <LogoPicker
        file={logo}
        currentUrl={brand?.logoUrl}
        currentAlt={`${brand?.name ?? "Brand"} logo`}
        onChange={setLogo}
      />
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
