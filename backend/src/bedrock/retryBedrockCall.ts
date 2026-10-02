// Retry policy shared by every Bedrock call (embeddings and answers).

const RETRYABLE_ERRORS = [
  'ThrottlingException',
  'ServiceUnavailableException',
  'ModelNotReadyException',
  'InternalServerException',
];

// Account or model setup problems: no access, model not enabled in this
// region, bad model id. Retrying won't help.
export const BEDROCK_SETUP_ERRORS = [
  'AccessDeniedException',
  'UnrecognizedClientException',
  'ValidationException',
  'ResourceNotFoundException',
];

const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 500;

export const bedrockErrorName = (error: unknown): string =>
  (error as { name?: string } | null)?.name ?? '';

export const isRetryableBedrockError = (error: unknown): boolean =>
  RETRYABLE_ERRORS.includes(bedrockErrorName(error));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Exponential backoff with jitter, so parallel requests that were
// throttled together don't retry in lockstep.
const backoffDelay = (attempt: number): number =>
  BASE_DELAY_MS * 2 ** attempt * (0.5 + Math.random() / 2);

// Runs `call` until it succeeds, fails with a non-retryable error, or
// runs out of attempts. `canRetry` lets a streaming caller stop retrying
// once part of the answer has already been sent.
export const retryBedrockCall = async <T>(
  call: () => Promise<T>,
  options: { maxAttempts?: number; canRetry?: () => boolean } = {},
): Promise<T> => {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      const isRetryable =
        attempt < maxAttempts &&
        isRetryableBedrockError(error) &&
        (options.canRetry?.() ?? true);
      if (!isRetryable) throw error;
      await wait(backoffDelay(attempt));
    }
  }
};
