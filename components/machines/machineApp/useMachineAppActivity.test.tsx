import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listDesigns } from "@/lib/api/machineDesignApi";
import { listMachineDocumentsRequest } from "@/lib/api/machineDocumentsApi";
import { listMachineHistoryRequest } from "@/lib/api/machineHistoryApi";
import { useMachineAppActivity } from "./useMachineAppActivity";

vi.mock("@/lib/api/requireAccessToken", () => ({ requireAccessToken: () => "token" }));
vi.mock("@/lib/api/machineHistoryApi", () => ({ listMachineHistoryRequest: vi.fn() }));
vi.mock("@/lib/api/machineDocumentsApi", () => ({ listMachineDocumentsRequest: vi.fn() }));
vi.mock("@/lib/api/machineDesignApi", () => ({ listDesigns: vi.fn() }));

const session = {
  id: "s1", requesterName: "Sam", startedAt: "2026-11-20T10:00:00Z", endedAt: "2026-11-20T10:05:00Z",
  durationSeconds: 300, endReason: "portal_ended", recordingStatus: "completed", transcriptStatus: "completed",
};
const document = (id: string, uploadedAt: string, fromTablet: boolean) => ({
  id, uploadedAt, fromTablet, fileName: `${id}.pdf`, documentType: "other", sizeBytes: 10, contentType: "application/pdf",
  historyEntryId: null, signedUrl: "", downloadUrl: "", uploadedByName: null, canDelete: false,
});

beforeEach(() => {
  vi.mocked(listMachineHistoryRequest).mockResolvedValue([
    { id: "h1", createdAt: "2026-11-20T10:05:00Z", remoteSession: session },
    { id: "h2", createdAt: "2026-11-19T00:00:00Z", remoteSession: null },
  ] as never);
  vi.mocked(listMachineDocumentsRequest).mockResolvedValue([
    document("tablet", "2026-11-20T12:00:00Z", true),
    document("portal", "2026-11-20T13:00:00Z", false),
  ] as never);
  vi.mocked(listDesigns).mockResolvedValue({
    versions: [{ id: "v1", files: [{ path: "a.dxf", sizeBytes: 5, sha256: "" }] }],
    deliveries: [
      { id: "d1", machineId: "m1", versionId: "v1", createdAt: "2026-11-20T11:00:00Z", project: "Pad", status: "arrived" },
      { id: "d2", machineId: "other", versionId: "v1", createdAt: "2026-11-20T14:00:00Z", project: "Other", status: "arrived" },
    ],
  } as never);
});
afterEach(cleanup);

describe("machine app activity", () => {
  it("merges sessions, tablet files and this machine's deliveries, newest first", async () => {
    const { result } = renderHook(() => useMachineAppActivity("m1", true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(["received-tablet", "sent-d1", "session-s1"]);
    expect(listMachineHistoryRequest).toHaveBeenCalledWith("token", "m1", expect.objectContaining({ type: "remote_session" }));
  });

  it("keeps what loaded when one source fails, and skips designs without permission", async () => {
    vi.mocked(listMachineDocumentsRequest).mockRejectedValue(new Error("offline"));
    vi.mocked(listDesigns).mockClear();
    const { result } = renderHook(() => useMachineAppActivity("m1", false));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((item) => item.kind)).toEqual(["session"]);
    expect(result.current.problems).toHaveLength(1);
    expect(listDesigns).not.toHaveBeenCalled();
  });
});
