import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAdminUsersRequest } from "@/lib/api/adminUsersApi";
import type { AdminUser } from "@/lib/types/adminUser";
import { useAdminUsers } from "./useAdminUsers";

vi.mock("@/lib/auth/authSession", () => ({ getAccessToken: () => "session" }));
vi.mock("@/lib/api/adminUsersApi", () => ({ listAdminUsersRequest: vi.fn() }));
const user = (id: number, role = "Customer"): AdminUser => ({
  id: String(id), firstName: `User ${id}`, lastName: "Test", email: `user${id}@example.com`,
  roles: [role], avatarUrl: null, status: "active", organisation: { id: "org", name: "Org" },
  lastActiveAt: null, createdAt: "2026-01-01T00:00:00Z",
});
const response = (users: AdminUser[], total = users.length) => ({ users, total, page: 1, pageSize: 100 });
beforeEach(() => vi.mocked(listAdminUsersRequest).mockReset());
afterEach(cleanup);

describe("local user filtering", () => {
  it("filters role and search without further API requests", async () => {
    vi.mocked(listAdminUsersRequest).mockResolvedValue(response([user(1), user(2, "Owner")]));
    const { result, rerender } = renderHook(({ search, role }) => useAdminUsers(search, role, 1), { initialProps: { search: "", role: "" } });
    await waitFor(() => expect(result.current.total).toBe(2));
    rerender({ search: "", role: "Owner" });
    expect(result.current.users.map((u) => u.id)).toEqual(["2"]);
    expect(result.current.isLoading).toBe(false);
    rerender({ search: "USER1@", role: "" });
    expect(result.current.users.map((u) => u.id)).toEqual(["1"]);
    rerender({ search: "missing", role: "" });
    expect(result.current.total).toBe(0);
    expect(listAdminUsersRequest).toHaveBeenCalledTimes(1);
  });

  it("loads all API pages before filtering and paginates locally", async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => user(i));
    vi.mocked(listAdminUsersRequest)
      .mockResolvedValueOnce(response(firstPage, 101))
      .mockResolvedValueOnce(response([user(100, "Owner")], 101));
    const { result, rerender } = renderHook(({ role, page }) => useAdminUsers("", role, page), { initialProps: { role: "", page: 1 } });
    await waitFor(() => expect(result.current.total).toBe(101));
    expect(result.current.users).toHaveLength(25);
    expect(listAdminUsersRequest).toHaveBeenLastCalledWith("session", { page: 2, pageSize: 100 });
    rerender({ role: "Owner", page: 1 });
    expect(result.current.users[0].id).toBe("100");
    expect(result.current.total).toBe(1);
    rerender({ role: "", page: 5 });
    expect(result.current.users.map((u) => u.id)).toEqual(["100"]);
    expect(listAdminUsersRequest).toHaveBeenCalledTimes(2);
  });

  it("refreshes the directory after a mutation", async () => {
    vi.mocked(listAdminUsersRequest).mockResolvedValueOnce(response([user(1)]));
    const { result } = renderHook(() => useAdminUsers("", "Owner", 1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.total).toBe(0);
    vi.mocked(listAdminUsersRequest).mockResolvedValueOnce(response([user(1, "Owner")]));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.total).toBe(1));
    expect(listAdminUsersRequest).toHaveBeenCalledTimes(2);
  });
});
