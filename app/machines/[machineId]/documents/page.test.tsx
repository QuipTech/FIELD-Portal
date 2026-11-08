import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Machine } from "@/lib/types/machine";
import MachineDocumentsPage from "./page";

const state = vi.hoisted(() => ({ machine: null as unknown }));

vi.mock("@/lib/auth/usePermissions", () => ({
  usePermissions: () => ({ isLoaded: true, can: (code: string) => code === "history.create" }),
}));
vi.mock("../machineDetailContext", () => ({
  useMachineDetail: () => ({ machineId: "m1", machine: state.machine, service: {}, notify: vi.fn() }),
}));
vi.mock("./useMachineDocuments", () => ({
  useMachineDocuments: () => ({ data: [], isLoading: false, error: null, reload: vi.fn(), reloadAfterChange: vi.fn() }),
}));
afterEach(cleanup);

const machine = { id: "m1", assetId: "DZ358", lifecycleState: "registered", isShared: false, accessLevel: "owner" } as Machine;

// Documents are open in every lifecycle state, unlike history and photos.
describe("documents tab", () => {
  it.each(["registered", "archived", "active"] as const)("offers upload on a %s machine", (lifecycleState) => {
    state.machine = { ...machine, lifecycleState };
    render(<MachineDocumentsPage />);
    expect(screen.getByRole("button", { name: /Upload the first document/ })).toBeTruthy();
  });

  it("offers no upload on a view-only share", () => {
    state.machine = { ...machine, isShared: true, accessLevel: "view" };
    render(<MachineDocumentsPage />);
    expect(screen.queryByRole("button", { name: /Upload/ })).toBeNull();
  });
});
