// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SendToTablet } from "./sendToTablet";

const list = vi.fn();
const send = vi.fn();
vi.mock("@/lib/api/tabletFilesApi", () => ({
  listTabletFileSendsRequest: (...args: unknown[]) => list(...args),
  sendTabletFilesRequest: (...args: unknown[]) => send(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SendToTablet", () => {
  it("sends dropped files, retries with the same send ID and shows the status", async () => {
    list.mockResolvedValueOnce({ sends: [] }).mockResolvedValue({
      sends: [{ id: "d1", sendId: "s1", status: "waiting", error: null, senderName: "Ada", createdAt: "2026-11-27T01:00:00Z", updatedAt: "2026-11-27T01:00:00Z", files: [{ name: "pit.dxf", sizeBytes: 4 }] }],
    });
    send.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({});
    render(<SendToTablet machineId="m1" />);

    const file = new File(["data"], "pit.dxf");
    fireEvent.drop(screen.getByText("Drop files here"), { dataTransfer: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Send to tablet" }));
    await screen.findByText("Couldn't send the files. Check your connection and try again.");
    fireEvent.click(screen.getByRole("button", { name: "Send to tablet" }));

    await screen.findByText("Waiting");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Send to tablet" })).toBeNull());
    expect(send.mock.calls[0]).toEqual(["m1", expect.any(String), [file]]);
    expect(send.mock.calls[1][1]).toBe(send.mock.calls[0][1]);
  });

  it("blocks a file over the limit", () => {
    list.mockResolvedValue({ sends: [] });
    render(<SendToTablet machineId="m1" />);
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.bin");
    fireEvent.change(screen.getByLabelText("Files to send to the tablet"), { target: { files: [file] } });
    expect(screen.getByRole("alert").textContent).toBe("big.bin is over 5 MB.");
    expect((screen.getByRole("button", { name: "Send to tablet" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
