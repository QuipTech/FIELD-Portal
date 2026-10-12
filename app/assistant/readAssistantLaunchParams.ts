// /assistant?machine=<id>&prompt=<text> (from a machine's "Ask AI"
// buttons) starts a new thread about that machine with the question
// typed in. /assistant?document=<id>&documentTitle=<title> (a Knowledge
// article's "Ask AI") answers the first question from that document only.
// Read from location rather than useSearchParams to keep the page static.
export interface AssistantLaunchParams {
  machineId: string | null;
  prompt: string | null;
  document: { id: string; title: string } | null;
}

export const readAssistantLaunchParams = (): AssistantLaunchParams => {
  const params = new URLSearchParams(window.location.search);
  const documentId = params.get("document");
  return {
    machineId: params.get("machine"),
    prompt: params.get("prompt"),
    document: documentId ? { id: documentId, title: params.get("documentTitle") ?? "this document" } : null,
  };
};
