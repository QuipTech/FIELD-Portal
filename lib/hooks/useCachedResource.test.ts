import { describe, expect, it, vi } from "vitest";
import { loadCached } from "./useCachedResource";

vi.mock("../api/requireAccessToken", () => ({ requireAccessToken: () => "test-token" }));

describe("loadCached", () => {
  it("shares one request between callers and skips a fresh copy", async () => {
    const load = vi.fn(async () => ["Caterpillar"]);
    await Promise.all([loadCached("shared", load, "failed"), loadCached("shared", load, "failed")]);
    await loadCached("shared", load, "failed");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads again when forced, even while an older load is running", async () => {
    const load = vi.fn(async () => ["Caterpillar"]);
    const first = loadCached("forced", load, "failed");
    const forced = loadCached("forced", load, "failed", true);
    await Promise.all([first, forced]);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
