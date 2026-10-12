// /assistant opens a new thread about the machine, with the question
// typed into the composer (not sent) when one is given.
export const buildAssistantHref = (machineId: string, question?: string): string => {
  const params = new URLSearchParams({ machine: machineId });
  if (question) params.set("prompt", question);
  return `/assistant?${params.toString()}`;
};
