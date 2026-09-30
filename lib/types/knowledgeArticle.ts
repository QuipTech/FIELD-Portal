import type { Tone } from "@/components/ui/tone";

export interface KnowledgeArticleDetail {
  slug: string;
  title: string;
  tags: { label: string; tone: Tone }[];
  intro: string;
  imageCaption: string;
  prerequisites: string[];
}
