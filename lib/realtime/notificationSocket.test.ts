import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  io: vi.fn(),
  sockets: [] as {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock("socket.io-client", () => ({ io: mocks.io }));
vi.mock("../api/httpClient", () => ({ API_BASE_URL: "http://localhost:4001" }));
vi.mock("../auth/authSession", () => ({ getAccessToken: () => "test-token" }));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  mocks.io.mockReset();
  mocks.sockets.length = 0;
  mocks.io.mockImplementation(() => {
    const socket = { connect: vi.fn(), disconnect: vi.fn(), on: vi.fn() };
    mocks.sockets.push(socket);
    return socket;
  });
});
afterEach(() => vi.useRealTimers());
describe("notification socket lifecycle", () => {
  it("cancels the initial Strict Mode mount before opening its WebSocket", async () => {
    const { subscribeToNewNotifications } = await import("./notificationSocket");
    const firstCleanup = subscribeToNewNotifications(vi.fn());
    firstCleanup();
    const secondCleanup = subscribeToNewNotifications(vi.fn());
    vi.runAllTimers();
    expect(mocks.sockets[0].connect).not.toHaveBeenCalled();
    expect(mocks.sockets[1].connect).toHaveBeenCalledTimes(1);
    expect(mocks.io.mock.calls[0][1].autoConnect).toBe(false);
    secondCleanup();
  });
  it("shares one connection and closes it only after the last listener leaves", async () => {
    const { subscribeToNewNotifications } = await import("./notificationSocket");
    const firstCleanup = subscribeToNewNotifications(vi.fn());
    const secondCleanup = subscribeToNewNotifications(vi.fn());
    vi.runAllTimers();
    expect(mocks.io).toHaveBeenCalledTimes(1);
    firstCleanup();
    expect(mocks.sockets[0].disconnect).not.toHaveBeenCalled();
    secondCleanup();
    expect(mocks.sockets[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
