import type { KnowledgeCategory } from "../types/knowledgeBrand";

// Categories in folder order (each parent followed by its subfolders), with the
// full folder path as `label` and the nesting level as `depth`.
export const categoryOptions = (categories: KnowledgeCategory[]) => {
  const ids = new Set(categories.map((category) => category.id));
  const children = new Map<string | null, KnowledgeCategory[]>();
  categories.forEach((category) => {
    const parentId = category.parentId && ids.has(category.parentId) ? category.parentId : null;
    children.set(parentId, [...(children.get(parentId) ?? []), category]);
  });
  const ordered: (KnowledgeCategory & { label: string; depth: number })[] = [];
  const seen = new Set<string>();
  const visit = (parentId: string | null, path: string[]) => {
    (children.get(parentId) ?? []).forEach((category) => {
      if (seen.has(category.id)) return;
      seen.add(category.id);
      const names = [...path, category.name];
      ordered.push({ ...category, label: names.join(" / "), depth: path.length });
      visit(category.id, names);
    });
  };
  visit(null, []);
  // A parent cycle would leave categories unreachable from the top level; still list them.
  categories
    .filter((category) => !seen.has(category.id))
    .forEach((category) => ordered.push({ ...category, label: category.name, depth: 0 }));
  return ordered;
};
