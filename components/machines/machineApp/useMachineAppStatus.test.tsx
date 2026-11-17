import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMachineAppStatus } from "./useMachineAppStatus";
import { getMachineAppConnectionRequest } from "@/lib/api/machineAppConnectionApi";
vi.mock("@/lib/api/machineAppConnectionApi", () => ({ getMachineAppConnectionRequest: vi.fn() }));
const paired = { connected: true, device: { id: "d1", serialNumber: null, platform: "windows", appVersion: null, pairedAt: "2026-11-17T00:00:00Z" }, session: { status: "pending" as const, tabletOnline: true, portalOnline: false } };
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
beforeEach(() => { vi.useFakeTimers(); vi.mocked(getMachineAppConnectionRequest).mockReset().mockResolvedValue(paired); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("tablet status polling", () => {
  it("shows Windows-initiated unpairing without manual refresh", async () => {
    const { result } = renderHook(() => useMachineAppStatus("m1"));
    await flush();
    expect(result.current.data?.session?.tabletOnline).toBe(true);
    vi.mocked(getMachineAppConnectionRequest).mockResolvedValue({ connected: false, device: null, session: null });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.data?.connected).toBe(false);
  });
  it("reports a failed poll so the UI cannot claim fresh Online status", async () => {
    const { result } = renderHook(() => useMachineAppStatus("m1"));
    await flush();
    vi.mocked(getMachineAppConnectionRequest).mockRejectedValue(new Error("Network unavailable"));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.error).toBeTruthy();
  });
  it("does not fetch when Machine Control is disabled", async () => {
    renderHook(() => useMachineAppStatus("m1", false));
    await flush();
    expect(getMachineAppConnectionRequest).not.toHaveBeenCalled();
  });
  it("ignores a response from the previous machine", async () => {
    let finish!: (value: typeof paired) => void;
    vi.mocked(getMachineAppConnectionRequest).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ id }) => useMachineAppStatus(id), { initialProps: { id: "m1" } });
    rerender({ id: "m2" });
    await flush();
    await act(async () => { finish({ ...paired, connected: false }); });
    expect(result.current.data?.connected).toBe(true);
  });
});
