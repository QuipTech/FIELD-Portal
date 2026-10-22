"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { SelectInput } from "@/components/ui/selectInput";
import { Button } from "@/components/ui/button";
import { toSlug } from "@/lib/knowledge/toSlug";
import type { categoryOptions } from "@/lib/knowledge/categoryOptions";
import type { KnowledgeCategoryInput } from "@/lib/types/knowledgeBrand";

type CategoryOption = ReturnType<typeof categoryOptions>[number];

interface Props {
  initial: KnowledgeCategoryInput;
  editingId?: string;
  categories: CategoryOption[];
  busy: boolean;
  error: string | null;
  onSave: (value: KnowledgeCategoryInput) => void;
  onCancel: () => void;
}

// Mounted with a fresh `key` per target, so its state always starts from `initial`.
export const CategoryForm = ({ initial, editingId, categories, busy, error, onSave, onCancel }: Props) => {
  const [value, setValue] = useState(initial);
  // A new folder's slug follows its name until someone edits the slug by hand.
  const [slugTouched, setSlugTouched] = useState(Boolean(editingId));
  const parent = categories.find((category) => category.id === value.parentId);
  const heading = editingId
    ? `Edit "${initial.name}"`
    : parent
      ? `New subfolder in ${parent.label}`
      : "New top-level folder";
  const byId = new Map(categories.map((category) => [category.id, category]));
  // A folder can't move inside itself or one of its own subfolders.
  const isInsideEdited = (category: CategoryOption) => {
    const seen = new Set<string>();
    for (let current: CategoryOption | undefined = category; current && !seen.has(current.id); ) {
      if (current.id === editingId) return true;
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
  };
  const parentChoices = editingId ? categories.filter((category) => !isInsideEdited(category)) : categories;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(value);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-borderGray pt-4">
      <h3 className="text-sm font-medium text-ink">{heading}</h3>
      <label className="flex flex-col gap-1 text-xs text-bodyGray">
        Folder name
        <Input
          required
          autoFocus
          maxLength={150}
          placeholder="e.g. Machine maintenance"
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
        Slug
        <Input
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="machine-maintenance"
          value={value.slug}
          onChange={(event) => {
            setSlugTouched(true);
            setValue({ ...value, slug: event.target.value });
          }}
        />
        <span className="text-mutedGray">Filled in from the name. Lowercase letters, numbers and dashes only.</span>
      </label>
      <label className="flex flex-col gap-1 text-xs text-bodyGray">
        Inside folder
        <SelectInput
          value={value.parentId ?? ""}
          onChange={(event) => setValue({ ...value, parentId: event.target.value || null })}
        >
          <option value="">None (top-level folder)</option>
          {parentChoices.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </SelectInput>
      </label>
      <label className="flex flex-col gap-1 text-xs text-bodyGray">
        Display order
        <Input
          type="number"
          value={value.sortOrder}
          onChange={(event) => setValue({ ...value, sortOrder: Number(event.target.value) })}
        />
        <span className="text-mutedGray">Lower numbers show first.</span>
      </label>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : editingId ? "Save changes" : "Add folder"}
        </Button>
        {(editingId || value.parentId || value.name) && (
          <Button type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};
