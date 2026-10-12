export interface ServerSentEvent {
  event: string;
  data: unknown;
}

// One "event: …\ndata: …" block. Events without a data line are skipped.
const parseEventBlock = (block: string): ServerSentEvent | null => {
  let event = "message";
  const dataLines: string[] = [];
  block.split("\n").forEach((line) => {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  });
  if (!dataLines.length) return null;
  return { event, data: JSON.parse(dataLines.join("\n")) };
};

// Reads a text/event-stream response body (e.g. from a POST, which
// EventSource can't send), calling onEvent for each complete event.
export const readEventStream = async (response: Response, onEvent: (event: ServerSentEvent) => void): Promise<void> => {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
    const blocks = buffer.split("\n\n");
    buffer = done ? "" : blocks.pop() ?? "";
    blocks.forEach((block) => {
      const parsed = parseEventBlock(block);
      if (parsed) onEvent(parsed);
    });
    if (done) return;
  }
};
