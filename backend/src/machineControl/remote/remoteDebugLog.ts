import { HttpException, Logger } from '@nestjs/common';

// Step-by-step remote support diagnostics in the API log, prefixed
// "[remote]". On unless NODE_ENV is production; REMOTE_SUPPORT_DEBUG_LOGS
// = true / false overrides either way. Never logs signed URLs, device
// tokens or ICE credentials.
export const remoteDebugEnabled = (): boolean => {
  const override = process.env.REMOTE_SUPPORT_DEBUG_LOGS;
  if (override === 'true') return true;
  if (override === 'false') return false;
  return process.env.NODE_ENV !== 'production';
};

const format = (event: string, details?: Record<string, unknown>) =>
  `[remote] ${event}${details ? ` ${JSON.stringify(details)}` : ''}`;

export class RemoteDebugLog {
  private readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  info(event: string, details?: Record<string, unknown>) {
    if (remoteDebugEnabled()) this.logger.log(format(event, details));
  }

  warn(event: string, details?: Record<string, unknown>) {
    if (remoteDebugEnabled()) this.logger.warn(format(event, details));
  }

  // Runs work, logging when it starts, succeeds or fails (with the error's
  // HTTP status and code), then returns or rethrows as before.
  async trace<T>(
    event: string,
    details: Record<string, unknown>,
    work: () => Promise<T>,
    summarize?: (result: T) => Record<string, unknown>,
  ): Promise<T> {
    if (!remoteDebugEnabled()) return work();
    const startedAt = Date.now();
    this.info(`${event}: start`, details);
    try {
      const result = await work();
      this.info(`${event}: ok`, {
        ...details,
        ms: Date.now() - startedAt,
        ...(summarize ? summarize(result) : {}),
      });
      return result;
    } catch (error) {
      this.warn(`${event}: FAILED`, {
        ...details,
        ms: Date.now() - startedAt,
        ...describeError(error),
      });
      throw error;
    }
  }
}

export const describeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    const body =
      typeof response === 'object' && response !== null
        ? (response as { code?: unknown; message?: unknown })
        : { message: response };
    return {
      httpStatus: error.getStatus(),
      code: body.code,
      message: body.message,
    };
  }
  if (error instanceof Error) {
    const meta = (
      error as { $metadata?: { httpStatusCode?: number; requestId?: string } }
    ).$metadata;
    return {
      name: error.name,
      message: error.message,
      ...(meta
        ? { awsStatus: meta.httpStatusCode, awsRequestId: meta.requestId }
        : {}),
    };
  }
  return { error: String(error) };
};
