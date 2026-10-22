import { apiRequest } from "./httpClient";
import type {
  KnowledgeBrand,
  KnowledgeBrandInput,
  KnowledgeCategory,
  KnowledgeCategoryInput,
  KnowledgeClassification,
} from "../types/knowledgeBrand";

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
export const listKnowledgeBrandsRequest = (token: string) =>
  apiRequest<KnowledgeBrand[]>("/knowledge/brands", { headers: headers(token) });
export const listKnowledgeCategoriesRequest = (token: string, brandId: string) =>
  apiRequest<KnowledgeCategory[]>(`/knowledge/brands/${brandId}/categories`, { headers: headers(token) });
export const listAllKnowledgeCategoriesRequest = (token: string) =>
  apiRequest<KnowledgeCategory[]>("/knowledge/categories", { headers: headers(token) });
export const saveKnowledgeBrandRequest =(token: string, input: KnowledgeBrandInput, id?: string) =>
  apiRequest<{ id: string }>(`/admin/knowledge/brands${id ? `/${id}` : ""}`, {
    method: id ? "PATCH" : "POST",
    headers: headers(token),
    body: JSON.stringify(input),
  });
export const deleteKnowledgeBrandRequest = (token: string, id: string) =>
  apiRequest(`/admin/knowledge/brands/${id}`, { method: "DELETE", headers: headers(token) });
export const saveKnowledgeCategoryRequest = (
  token: string,
  brandId: string,
  input: KnowledgeCategoryInput,
  id?: string,
) =>
  apiRequest<{ id: string }>(`/admin/knowledge/brands/${brandId}/categories${id ? `/${id}` : ""}`, {
    method: id ? "PATCH" : "POST",
    headers: headers(token),
    body: JSON.stringify(input),
  });
export const deleteKnowledgeCategoryRequest = (token: string, brandId: string, id: string) =>
  apiRequest(`/admin/knowledge/brands/${brandId}/categories/${id}`, { method: "DELETE", headers: headers(token) });
export const updateKnowledgeMetadataRequest = (
  token: string,
  id: string,
  input: KnowledgeClassification & { documentType: string },
) =>
  apiRequest(`/admin/knowledge/documents/${id}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify(input),
  });
export const uploadKnowledgeBrandLogoRequest = (token: string, id: string, file: File) => {
  const body = new FormData();
  body.append("file", file);
  return apiRequest(`/admin/knowledge/brands/${id}/logo`, { method: "POST", headers: headers(token), body });
};

export const listKnowledgeModelsRequest = (token: string) =>
  apiRequest<{ id: string; displayName: string }[]>("/knowledge/models", { headers: headers(token) });
