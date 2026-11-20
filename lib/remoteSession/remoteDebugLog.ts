import { API_BASE_URL } from "../api/apiConnection";

// Step-by-step remote session diagnostics in the browser console, prefixed
// "[remote]". On by default for staging and local APIs, off in production.
// Override per browser with localStorage "fieldRemoteDebug" = "1" or "0".
// The last entries are kept on window.__fieldRemoteLog; in DevTools run
// copy(window.__fieldRemoteLog.dump()) to share them.
// Never logs signed URLs, tokens or ICE credentials.

const MAX_ENTRIES = 500;

interface LogEntry {
  at: string;
  level: "info" | "warn" | "error";
  event: string;
  details?: Record<string, unknown>;
}

const isNonProductionApi = () => /staging|localhost|127\.0\.0\.1/i.test(API_BASE_URL);

const readOverride = (): boolean | null => {
  try {
    const value = window.localStorage.getItem("fieldRemoteDebug");
    if (value === "1") return true;
    if (value === "0") return false;
  } catch {
    // Storage blocked; fall back to the environment.
  }
  return null;
};

let enabledCache: boolean | null = null;

export const remoteDebugEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  enabledCache ??= readOverride() ?? isNonProductionApi();
  return enabledCache;
};

const entries: LogEntry[] = [];

const exposeBuffer = () => {
  const target = window as unknown as { __fieldRemoteLog?: unknown };
  target.__fieldRemoteLog ??= {
    entries,
    dump: () => entries.map((entry) => `${entry.at} ${entry.level.toUpperCase()} ${entry.event} ${entry.details ? JSON.stringify(entry.details) : ""}`).join("\n"),
    clear: () => entries.splice(0),
  };
};

const write = (level: LogEntry["level"], event: string, details?: Record<string, unknown>) => {
  if (!remoteDebugEnabled()) return;
  const entry: LogEntry = { at: new Date().toISOString(), level, event, ...(details ? { details } : {}) };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  exposeBuffer();
  const line = `[remote] ${entry.at.slice(11, 23)} ${event}`;
  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  if (details) method(line, details);
  else method(line);
};

export const remoteLog = {
  info: (event: string, details?: Record<string, unknown>) => write("info", event, details),
  warn: (event: string, details?: Record<string, unknown>) => write("warn", event, details),
  error: (event: string, details?: Record<string, unknown>) => write("error", event, details),
};

// An error as plain fields, including the API's HTTP status if it has one.
export const describeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const status = (error as { status?: unknown }).status;
    return { name: error.name, message: error.message, ...(typeof status === "number" ? { httpStatus: status } : {}) };
  }
  return { error: String(error) };
};

// "host", "srflx" (STUN, public address) or "relay" (TURN) from a candidate line.
export const candidateType = (candidate: string | undefined): string => /\btyp (\w+)/.exec(candidate ?? "")?.[1] ?? "unknown";

// ICE servers without credentials: only how many STUN and TURN URLs there are.
export const summarizeIceServers = (servers: RTCIceServer[] | undefined) => {
  const urls = (servers ?? []).flatMap((server) => (Array.isArray(server.urls) ? server.urls : [server.urls]));
  return {
    servers: servers?.length ?? 0,
    stun: urls.filter((url) => url.startsWith("stun:")).length,
    turnUdp: urls.filter((url) => url.startsWith("turn:") && !url.includes("transport=tcp")).length,
    turnTcp: urls.filter((url) => url.startsWith("turn") && url.includes("transport=tcp")).length,
    turns: urls.filter((url) => url.startsWith("turns:")).length,
  };
};

// The signaling host only; the query string carries the signature.
export const signalingHost = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
};
