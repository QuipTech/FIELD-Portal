import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPairingCodeRequest, getMachineAppConnectionRequest } from "@/lib/api/machineAppConnectionApi";
import { ConnectMachineAppDialog } from "./connectMachineAppDialog";

vi.mock("@/lib/api/machineAppConnectionApi", () => ({
  createPairingCodeRequest: vi.fn(),
  getMachineAppConnectionRequest: vi.fn(),
}));

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const flush = () => act(async () => vi.advanceTimersByTimeAsync(0));
const renderDialog = async (onConnected = vi.fn()) => {
  render(<ConnectMachineAppDialog machineId="m1" machineLabel="ABC-01" onConnected={onConnected} onClose={vi.fn()} />);
  await flush();
  return onConnected;
};

describe("ConnectMachineAppDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getMachineAppConnectionRequest).mockResolvedValue({ connected: false, device: null });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows the code for this machine and waits", async () => {
    vi.mocked(createPairingCodeRequest).mockResolvedValue({ connected: false, code: "123456", expiresAt: inMinutes(15) });
    await renderDialog();
    expect(createPairingCodeRequest).toHaveBeenCalledWith("m1");
    expect(screen.getByText("123 456")).toBeTruthy();
    expect(screen.getByText("Waiting for the machine to connect…")).toBeTruthy();
    expect(screen.getByText(/Works for ABC-01 only/)).toBeTruthy();
  });

  it("shows success when the machine connects, and Continue moves on", async () => {
    vi.mocked(createPairingCodeRequest).mockResolvedValue({ connected: false, code: "123456", expiresAt: inMinutes(15) });
    const onConnected = await renderDialog();
    vi.mocked(getMachineAppConnectionRequest).mockResolvedValue({
      connected: true,
      device: { id: "d1", serialNumber: null, platform: null, appVersion: null, pairedAt: new Date().toISOString() },
    });
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByText("ABC-01 is connected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("keeps waiting when one check fails", async () => {
    vi.mocked(createPairingCodeRequest).mockResolvedValue({ connected: false, code: "123456", expiresAt: inMinutes(15) });
    await renderDialog();
    vi.mocked(getMachineAppConnectionRequest).mockRejectedValueOnce(new Error("offline"));
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByText("123 456")).toBeTruthy();
  });

  it("offers a new code once it expires", async () => {
    vi.mocked(createPairingCodeRequest).mockResolvedValue({ connected: false, code: "123456", expiresAt: inMinutes(1) });
    await renderDialog();
    await act(async () => vi.advanceTimersByTimeAsync(61_000));
    expect(screen.queryByText("123 456")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Get a new code" }));
    await flush();
    expect(createPairingCodeRequest).toHaveBeenCalledTimes(2);
  });

  it("shows why a code couldn't be made, e.g. an inactive machine", async () => {
    const { ApiError } = await import("@/lib/api/httpClient");
    vi.mocked(createPairingCodeRequest).mockRejectedValue(new ApiError("Activate this machine to see full history, AI and support.", 403));
    await renderDialog();
    expect(screen.getByRole("alert").textContent).toContain("Activate this machine");
  });
});
