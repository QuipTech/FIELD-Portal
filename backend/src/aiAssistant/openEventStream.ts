import { Response } from 'express';
import { AskStreamEvent } from './types/aiAssistantResponse';

export interface EventStream {
  send: (event: AskStreamEvent) => void;
  close: () => void;
  // Aborts when the client disconnects before the stream is closed.
  signal: AbortSignal;
}

// Turns the response into a text/event-stream. Headers go out at once so
// the portal can show the answer as it arrives.
export const openEventStream = (response: Response): EventStream => {
  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  // Stops nginx-style proxies from buffering the whole answer.
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();

  const controller = new AbortController();
  response.on('close', () => {
    if (!response.writableFinished) controller.abort();
  });

  return {
    send: ({ event, data }) => {
      if (response.writableEnded) return;
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close: () => {
      if (!response.writableEnded) response.end();
    },
    signal: controller.signal,
  };
};
