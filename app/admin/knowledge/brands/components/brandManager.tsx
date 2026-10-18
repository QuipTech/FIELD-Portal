"use client";

import { useState } from "react";
import { Icon } from "@/components/icons/icon";
import { LinkButton } from "@/components/ui/linkButton";
import { refreshKnowledgeBrands, useKnowledgeBrands } from "@/lib/knowledge/knowledgeBrandStore";
import { Button } from "@/components/ui/button";
import { BrandEditor } from "./brandEditor";
import { CategoryManager } from "./categoryManager";

export const BrandManager = () => {
  const brands = useKnowledgeBrands();
  const [selected, setSelected] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const brand = brands.data?.find((item) => item.id === selected) ?? null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <LinkButton href="/admin/knowledge" variant="ghost" aria-label="Back to Knowledge" className="px-2">
          <Icon name="chevl" className="h-5 w-5" />
          Back
        </LinkButton>
        <h1 className="text-[22px] font-medium text-ink">Manage Knowledge brands</h1>
      </div>
      {brands.error && <p className="text-danger">{brands.error}</p>}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_1fr_1fr]">
        <nav aria-label="Knowledge brands" className="flex flex-col gap-2">
          <Button variant={selected === null ? "primary" : "default"} onClick={() => setSelected(null)}>
            New brand
          </Button>
          {(brands.data ?? []).map((item) => (
            <Button
              key={item.id}
              variant={selected === item.id ? "primary" : "default"}
              onClick={() => setSelected(item.id)}
            >
              {item.name}
              {!item.isActive ? " (inactive)" : ""}
            </Button>
          ))}
        </nav>
        <BrandEditor
          key={`${selected}-${revision}`}
          brand={brand}
          onSaved={() => {
            void refreshKnowledgeBrands();
            setRevision((value) => value + 1);
          }}
        />
        {brand && <CategoryManager key={brand.id} brandId={brand.id} brandName={brand.name} />}
      </div>
    </>
  );
};
