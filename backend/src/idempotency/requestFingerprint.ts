import { createHash } from 'crypto';
import { Request } from 'express';

// Key order shouldn't matter: a client may rebuild the same body on retry.
const toStableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(toStableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${toStableJson((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

// SHA-256 of the body plus any uploaded file, so a reused key with a
// different payload can be told apart from a genuine retry.
export const fingerprintRequest = (request: Request & { file?: { buffer?: Buffer } }): string => {
  const hash = createHash('sha256').update(toStableJson(request.body ?? {}));
  if (request.file?.buffer) hash.update(request.file.buffer);
  return hash.digest('hex');
};
