export const expiresInSeconds = (seconds: number) =>
  new Date(Date.now() + seconds * 1000).toISOString();

// Quotes are stripped from the plain filename; filename* carries the exact
// (UTF-8) name for browsers that support it.
export const toAttachmentDisposition = (fileName: string) =>
  `attachment; filename="${fileName.replace(/["\\\r\n]/g, '')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
