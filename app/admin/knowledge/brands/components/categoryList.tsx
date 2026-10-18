"use client";

import { Icon } from "@/components/icons/icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import type { categoryOptions } from "@/lib/knowledge/categoryOptions";

type CategoryOption = ReturnType<typeof categoryOptions>[number];

interface Props {
  categories: CategoryOption[];
  editingId?: string;
  busy: boolean;
  onAddSubfolder: (parent: CategoryOption) => void;
  onEdit: (category: CategoryOption) => void;
  onDelete: (category: CategoryOption) => void;
}

// The brand's folders as an indented tree, each with its own actions.
export const CategoryList = ({ categories, editingId, busy, onAddSubfolder, onEdit, onDelete }: Props) => {
  if (!categories.length)
    return (
      <EmptyState
        icon="layers"
        title="No folders yet"
        description="Add a top-level folder below, such as Machine maintenance, then add subfolders inside it."
        className="py-6"
      />
    );
  return (
    <ul className="flex flex-col gap-1">
      {categories.map((category) => (
        <li
          key={category.id}
          style={{ paddingLeft: `${category.depth * 20 + 8}px` }}
          className={`flex flex-wrap items-center gap-2 rounded-lg py-2 pr-2 ${
            editingId === category.id ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-fillGray"
          }`}
        >
          <Icon name="layers" className="h-4 w-4 flex-none text-mutedGray" />
          <span className="mr-auto flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-ink">{category.name}</span>
            <span className="truncate text-xs text-mutedGray">
              {category.slug} · order {category.sortOrder}
            </span>
          </span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAddSubfolder(category)}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            Subfolder
          </Button>
          <Button size="sm" disabled={busy} onClick={() => onEdit(category)}>
            Edit
          </Button>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => onDelete(category)}>
            Delete
          </Button>
        </li>
      ))}
    </ul>
  );
};
