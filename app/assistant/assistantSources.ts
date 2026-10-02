import { requireAccessToken } from "@/lib/api/requireAccessToken";
import { getDocumentDownloadUrlRequest } from "@/lib/api/documentsApi";
import type { AssistantMessage, AssistantSource } from "@/lib/types/aiAssistant";

// "Service manual p. 214", or the section when there's no page.
export const describeSource = (source: AssistantSource): string => {
  if (source.page !== null) return `${source.title} p. ${source.page}`;
  return source.heading ? `${source.title} · ${source.heading}` : source.title;
};

// The sources an answer actually cites, in [n] order.
export const findCitedSources = (message: AssistantMessage): AssistantSource[] =>
  message.sources.filter((source) => message.citedIndexes.includes(source.index));

// The tab opens before the signed URL is fetched, so pop-up blockers
// treat it as part of the click.
export const openSourceDocument = async (source: AssistantSource): Promise<void> => {
  if (!source.documentId) return;
  const tab = window.open("", "_blank");
  try {
    const signed = await getDocumentDownloadUrlRequest(requireAccessToken(), source.documentId);
    if (tab) tab.location.href = signed.url;
    else window.open(signed.url, "_blank", "noopener");
  } catch (error) {
    tab?.close();
    throw error;
  }
};
