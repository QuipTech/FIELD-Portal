// /assistant?machine=<id>&prompt=<text> (from a machine's "Ask AI"
// buttons) starts a new thread about that machine with the question
// typed in. Read from location rather than useSearchParams to keep the
// page static.
export const readAssistantLaunchParams = (): { machineId: string | null; prompt: string | null } => {
  const params = new URLSearchParams(window.location.search);
  return { machineId: params.get("machine"), prompt: params.get("prompt") };
};
