import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MachinePhotoGallery } from "./machinePhotoGallery";
import { useMachineDetail } from "../machineDetailContext";
import { usePermissions } from "@/lib/auth/usePermissions";
import { invalidateCached } from "@/lib/machineDetail/resourceCache";

vi.mock("../machineDetailContext", () => ({ useMachineDetail: vi.fn() }));
vi.mock("@/lib/auth/usePermissions", () => ({ usePermissions: vi.fn() }));
afterEach(cleanup);

const photo = (id: string, overrides = {}) => ({
  id,
  caption: id,
  contentType: "image/jpeg",
  url: `https://signed/${id}`,
  canDelete: true,
  isCover: false,
  ...overrides,
});

const service = { listPhotos: vi.fn(), uploadPhoto: vi.fn(), deletePhoto: vi.fn(), setCoverPhoto: vi.fn() };
const context = { reloadMachine: vi.fn(), notify: vi.fn(), notifyError: vi.fn() };

const renderGallery = (machine: { isShared: boolean; accessLevel: string }, canManage = true) => {
  vi.mocked(useMachineDetail).mockReturnValue({ machineId: "m1", machine, service, ...context } as never);
  vi.mocked(usePermissions).mockReturnValue({ isLoaded: true, can: () => canManage } as never);
  render(<MachinePhotoGallery />);
};
const own = { isShared: false, accessLevel: "owner" };
const contribute = { isShared: true, accessLevel: "contribute" };
const openMenu = async () => fireEvent.click(await screen.findByRole("button", { name: "Actions for Photo 1" }));

describe("machine photo gallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateCached("machine:m1:");
    service.deletePhoto.mockResolvedValue(undefined);
    service.setCoverPhoto.mockResolvedValue(undefined);
  });

  it("offers an owner both actions, and marks the cover", async () => {
    service.listPhotos.mockResolvedValue([photo("a", { isCover: true }), photo("b")]);
    renderGallery(own);
    expect(await screen.findByText("Cover")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Photo 2" }));
    expect(screen.getByRole("menuitem", { name: "Set as cover" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete photo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Set as cover" }));
    await waitFor(() => expect(service.setCoverPhoto).toHaveBeenCalledWith("m1", "b"));
    expect(context.reloadMachine).toHaveBeenCalled();
  });

  it("gives a contributor delete on its own photos only, and never cover", async () => {
    service.listPhotos.mockResolvedValue([photo("mine"), photo("theirs", { canDelete: false })]);
    renderGallery(contribute);
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: "Set as cover" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Delete photo" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    await screen.findByText(/Photo 2 of 2/);
    expect(screen.queryByRole("button", { name: "Actions for Photo 2" })).toBeNull();
  });

  it("shows no actions without machine.manage", async () => {
    service.listPhotos.mockResolvedValue([photo("a")]);
    renderGallery(own, false);
    await screen.findByText(/Photo 1 of 1/);
    expect(screen.queryByRole("button", { name: "Actions for Photo 1" })).toBeNull();
  });

  it("stays on a valid photo after deleting the last one, then shows the empty state", async () => {
    service.listPhotos.mockResolvedValue([photo("a"), photo("b")]);
    renderGallery(own);
    await screen.findByText(/Photo 1 of 2/);
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Photo 2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete photo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete photo" }));
    await screen.findByText(/Photo 1 of 1/);
    expect(service.deletePhoto).toHaveBeenCalledWith("m1", "b");
    expect(context.notify).toHaveBeenCalledWith("Photo deleted");

    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete photo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete photo" }));
    await screen.findByText("No photos yet");
  });
});
