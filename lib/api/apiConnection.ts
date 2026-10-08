export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

// Tells the backend which app made the request; recorded as the Source
// of audit log events.
export const CLIENT_HEADERS = { "X-Field-Client": "web" };
