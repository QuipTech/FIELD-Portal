"use client";

import {
  listAllKnowledgeCategoriesRequest,
  listKnowledgeBrandsRequest,
  listKnowledgeCategoriesRequest,
} from "../api/knowledgeBrandsApi";
import { loadCached, primeCached, useCachedResource } from "../hooks/useCachedResource";
import type { KnowledgeBrand, KnowledgeCategory } from "../types/knowledgeBrand";

const BRANDS_KEY = "knowledge:brands";
const categoriesKey = (brandId: string) => `knowledge:categories:${brandId}`;
const loadCategories = (brandId: string) => (token: string) => listKnowledgeCategoriesRequest(token, brandId);

// Every brand's folders in one request, so picking a brand in any dropdown
// shows its folders straight away. A failure here is harmless: each brand
// then loads its own folders when it is picked.
const preloadAllCategories = async (token: string, brands: KnowledgeBrand[]) => {
  const categories = await listAllKnowledgeCategoriesRequest(token);
  brands.forEach((brand) =>
    primeCached(
      categoriesKey(brand.id),
      categories.filter((category) => category.brandId === brand.id),
    ),
  );
};

const loadBrands = async (token: string) => {
  const brands = await listKnowledgeBrandsRequest(token);
  void preloadAllCategories(token, brands).catch(() => undefined);
  return brands;
};

export const useKnowledgeBrands = () =>
  useCachedResource<KnowledgeBrand[]>(BRANDS_KEY, loadBrands, "Couldn't load brands.");

export const useKnowledgeCategories = (brandId: string) =>
  useCachedResource<KnowledgeCategory[]>(
    brandId ? categoriesKey(brandId) : null,
    loadCategories(brandId),
    "Couldn't load categories.",
  );

// Call after an edit so every screen picks up the change.
export const refreshKnowledgeBrands = () => loadCached(BRANDS_KEY, loadBrands, "Couldn't load brands.", true);
export const refreshKnowledgeCategories = (brandId: string) =>
  loadCached(categoriesKey(brandId), loadCategories(brandId), "Couldn't load categories.", true);
