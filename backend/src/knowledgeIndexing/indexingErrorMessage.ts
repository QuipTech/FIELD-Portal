import { DocumentExtractionError } from './extraction/documentBlocks';

// What admins see as the document's error. Problems with the file say how
// to fix it; setup problems say what's missing; anything else is generic
// (details go to the server log).
export const toIndexingErrorMessage = (error: unknown): string => {
  if (error instanceof DocumentExtractionError) return error.message;
  const name = (error as { name?: string })?.name ?? '';
  if (
    name === 'AccessDeniedException' ||
    name === 'UnrecognizedClientException'
  ) {
    return 'Indexing isn’t set up: the server has no access to the Bedrock embedding model (or Textract). Ask an administrator, then Retry.';
  }
  if (name === 'ValidationException' || name === 'ResourceNotFoundException') {
    return 'The Bedrock embedding model isn’t available in this region or account. Ask an administrator, then Retry.';
  }
  if (name === 'ThrottlingException') {
    return 'The AI service was busy for too long. Retry in a few minutes.';
  }
  return 'Indexing failed unexpectedly. Retry, or contact support if it keeps happening.';
};
