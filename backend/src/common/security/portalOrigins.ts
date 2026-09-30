// Origins allowed to call the API over HTTP and Socket.IO. Comma-separated,
// so local dev can allow both portal ports at once.
export const getPortalOrigins = (): string[] =>
  (process.env.PORTAL_ORIGIN ?? 'http://localhost:3001').split(',');
