import type { KnowledgeSearchResult, KnowledgeArticleDetail } from "@/lib/types/knowledgeArticle";

export const knowledgeSearchResults: KnowledgeSearchResult[] = [
  {
    slug: "rear-suspension-cylinder-recharge",
    title: "Rear suspension cylinder recharge",
    summary:
      "Nitrogen charging sequence, ride-height check and the torque values for the upper mount. Requires two technicians and the 8T-0820 charging group.",
    docLabel: "Procedure",
    docIcon: "tool",
    docTone: "default",
    metaLabel: "CAT 793F · Rev 4",
  },
  {
    slug: "suspension-system-specifications",
    title: "Suspension system — specifications",
    summary: "Charge pressures by machine weight class, cold and hot readings.",
    docLabel: "Manual §",
    docIcon: "book",
    docTone: "default",
    metaLabel: "Service manual · p. 214",
  },
  {
    slug: "bulletin-88-revised-charge-pressure",
    title: "Revised charge pressure for cylinders built after 2023",
    summary: "Supersedes the manual value for serial ranges 4GZ01100 and later.",
    docLabel: "Bulletin 88",
    docIcon: "alert",
    docTone: "amber",
    metaLabel: "Issued 14 Mar",
  },
];

export const knowledgeArticles: KnowledgeArticleDetail[] = [
  {
    slug: "rear-suspension-cylinder-recharge",
    title: "Rear suspension cylinder recharge",
    tags: [
      { label: "Procedure", tone: "default" },
      { label: "CAT 793F", tone: "default" },
      { label: "Rev 4", tone: "default" },
      { label: "Bulletin 88 applies", tone: "amber" },
    ],
    intro:
      "Charge the rear suspension cylinders to the pressure specified for the machine's loaded weight class. Two technicians are required: one at the charging group, one reading ride height.",
    imageCaption: "Figure 4 — charging group connection",
    prerequisites: [
      "Machine on level ground, body down, park brake applied and wheels chocked. Cylinder oil level verified within the last 250 h.",
      "Allow the machine to stand for 30 minutes before taking a cold reading — a hot cylinder reads up to 12% high.",
    ],
  },
];

export const findKnowledgeArticle = (slug: string): KnowledgeArticleDetail | undefined => {
  return knowledgeArticles.find((article) => article.slug === slug);
};
