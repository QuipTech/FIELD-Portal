import Link from "next/link";
import { Icon } from "@/components/icons/icon";
import { Tag } from "@/components/ui/tag";
import { buildArticleHref, type KnowledgeListContext } from "@/lib/knowledge/knowledgeLinks";
import { documentTypeIcon, knowledgeDocumentTypes } from "@/lib/types/adminDocument";
import type { KnowledgeArticle } from "@/lib/types/knowledgeArticle";

const typeLabel = (type: string) => knowledgeDocumentTypes.find((option) => option.value === type)?.label ?? type;

// "Bulletin MB-793F-2026-014 applies" from its title, or the title itself.
const bulletinLabel = (title: string) => {
  const reference = title.match(/\b[A-Z]{1,4}-[A-Z0-9-]{3,}\b/)?.[0];
  return `Bulletin ${reference ?? title} applies`;
};

interface ArticleTagsProps {
  article: KnowledgeArticle;
  listContext: KnowledgeListContext;
}

// Type, machine model, revision, source, and each bulletin that applies.
export const ArticleTags = ({ article, listContext }: ArticleTagsProps) => {
  const { icon, tone } = documentTypeIcon[article.type] ?? documentTypeIcon.manual;
  const model = [article.machineMake, article.machineModel].filter(Boolean).join(" ");
  return (
    <div className="flex flex-wrap gap-2">
      <Tag tone={tone}>
        <Icon name={icon} className="h-3.5 w-3.5" />
        {typeLabel(article.type)}
      </Tag>
      {model && <Tag>{model}</Tag>}
      <Tag>Rev {article.revision}</Tag>
      {article.source === "quiptech_library" && <Tag tone="primary">QuipTech library</Tag>}
      {article.appliesBulletins.map((bulletin) => (
        <Link key={bulletin.id} href={buildArticleHref(bulletin.id, listContext)} title={bulletin.title}>
          <Tag tone="amber">
            <Icon name="alert" className="h-3.5 w-3.5" />
            {bulletinLabel(bulletin.title)}
          </Tag>
        </Link>
      ))}
    </div>
  );
};
