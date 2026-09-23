import type { Tone } from "@/components/ui/tone";
import type { IconName } from "@/components/icons/icon";

export interface KnowledgeSearchResult {
  slug: string;
  title: string;
  summary: string;
  docLabel: string;
  docIcon: IconName;
  docTone: Tone;
  metaLabel: string;
}

export interface KnowledgeArticleDetail {
  slug: string;
  title: string;
  tags: { label: string; tone: Tone }[];
  intro: string;
  imageCaption: string;
  prerequisites: string[];
}
