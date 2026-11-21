import { describe, expect, it } from "vitest";
import { transfersDuring, type SessionTransfer } from "./sessionTransfers";

const at = (id: string, iso: string) => ({ kind: "received", id, at: iso, document: {} }) as unknown as SessionTransfer;

describe("files during a remote session", () => {
  const transfers = [
    at("before", "2026-11-20T09:59:59Z"),
    at("start", "2026-11-20T10:00:00Z"),
    at("during", "2026-11-20T10:03:00Z"),
    at("grace", "2026-11-20T10:06:30Z"),
    at("late", "2026-11-20T10:08:00Z"),
  ];

  it("keeps files from the start until two minutes after the end", () => {
    const ids = transfersDuring(transfers, { startedAt: "2026-11-20T10:00:00Z", endedAt: "2026-11-20T10:05:00Z" }).map((t) => t.id);
    expect(ids).toEqual(["start", "during", "grace"]);
  });

  it("has none for a session that never started", () => {
    expect(transfersDuring(transfers, { startedAt: null, endedAt: null })).toEqual([]);
  });

  it("uses now for a session still running", () => {
    const now = new Date("2026-11-20T10:04:00Z").getTime();
    const ids = transfersDuring(transfers, { startedAt: "2026-11-20T10:00:00Z", endedAt: null }, now).map((t) => t.id);
    expect(ids).toEqual(["start", "during"]);
  });
});
