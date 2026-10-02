import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BEDROCK_SETUP_ERRORS,
  bedrockErrorName,
  isRetryableBedrockError,
} from './retryBedrockCall';

// Technician-facing: never includes AWS error names, messages, model ids
// or request ids. The raw error is logged server-side instead.
export const ASSISTANT_BUSY_MESSAGE =
  'The assistant is busy right now. Try again in a moment.';
export const ASSISTANT_UNAVAILABLE_MESSAGE =
  "The assistant isn't available right now. Contact your administrator if this keeps happening.";
export const ASSISTANT_FAILED_MESSAGE =
  "The assistant couldn't finish that answer. Try again.";

export const toAssistantHttpError = (error: unknown): HttpException => {
  if (error instanceof HttpException) return error;
  if (isRetryableBedrockError(error)) {
    return new HttpException(
      ASSISTANT_BUSY_MESSAGE,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  if (BEDROCK_SETUP_ERRORS.includes(bedrockErrorName(error))) {
    return new ServiceUnavailableException(ASSISTANT_UNAVAILABLE_MESSAGE);
  }
  return new BadGatewayException(ASSISTANT_FAILED_MESSAGE);
};
