export interface KnowledgeBrand {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  logoFileId: string | null;
  logoUrl: string | null;
  documentCount: number;
}
export interface KnowledgeCategory {
  id: string;
  brandId: string;
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
}
export interface KnowledgeClassification {
  brandId: string;
  categoryId: string;
  machineModelIds?: string[];
}
export type KnowledgeBrandInput = Pick<KnowledgeBrand, "name" | "slug" | "description" | "isActive" | "sortOrder">;
export type KnowledgeCategoryInput = Pick<KnowledgeCategory, "name" | "slug" | "parentId" | "sortOrder">;
