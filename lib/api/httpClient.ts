export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const extractErrorMessage = (body: unknown): string => {
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message[0];
  return message ?? "Something went wrong. Please try again.";
};

// Tells the backend which app made the request; recorded as the Source
// of audit log events.
export const CLIENT_HEADERS = { "X-Field-Client": "web" };

export const apiRequest = async <TResponse>(path: string, options: RequestInit = {}): Promise<TResponse> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...CLIENT_HEADERS, ...options.headers },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(body), response.status);
  }

  return body as TResponse;
};

// For endpoints that return a file rather than JSON (e.g. CSV exports).
export const apiDownloadRequest = async (
  path: string,
  options: RequestInit = {},
): Promise<{ blob: Blob; headers: Headers }> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...CLIENT_HEADERS, ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(extractErrorMessage(body), response.status);
  }
  return { blob: await response.blob(), headers: response.headers };
};
