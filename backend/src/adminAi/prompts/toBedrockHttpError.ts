import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';

// Turns a Bedrock/SDK failure into a response an admin can act on. Most
// specific first: every class here extends APIError.
export const toBedrockHttpError = (
  error: unknown,
  modelId: string,
): HttpException | undefined => {
  if (
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError
  ) {
    return new BadGatewayException(
      `Bedrock refused the request. Check the server's AWS credentials and that ${modelId} is enabled for this account.`,
    );
  }
  if (error instanceof NotFoundError || error instanceof BadRequestError) {
    return new BadGatewayException(
      `Bedrock couldn't run ${modelId}: ${error.message}`,
    );
  }
  if (error instanceof RateLimitError) {
    return new HttpException(
      'Bedrock is rate limiting requests. Try again shortly.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  if (error instanceof APIConnectionError) {
    return new ServiceUnavailableException(
      "Couldn't reach Bedrock. Try again shortly.",
    );
  }
  if (error instanceof APIError) {
    return new BadGatewayException(
      `Bedrock returned an error (${error.status ?? 'unknown'}).`,
    );
  }
  return undefined;
};
