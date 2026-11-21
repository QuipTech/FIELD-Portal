import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioPump } from "./audioPump";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const install = () => {
  const written: { numberOfFrames: number; timestamp: number }[] = [];
  vi.stubGlobal("MediaStreamTrackGenerator", function () {
    return { stop: vi.fn(), writable: { getWriter: () => ({ write: async (data: never) => written.push(data), close: async () => undefined }) } };
  });
  vi.stubGlobal("MediaStreamTrackProcessor", function () {
    return { readable: { getReader: () => ({ read: () => new Promise(() => undefined), cancel: async () => undefined }) } };
  });
  vi.stubGlobal("AudioData", function (init: { numberOfFrames: number; timestamp: number }) {
    return { numberOfFrames: init.numberOfFrames, timestamp: init.timestamp };
  });
  return written;
};

describe("recording audio track", () => {
  it("is supported only with Chrome's track generator", () => {
    expect(AudioPump.isSupported()).toBe(false);
    install();
    expect(AudioPump.isSupported()).toBe(true);
  });

  it("keeps up with the clock in silence while no source delivers", () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const written = install();
    const pump = new AudioPump();
    now += 1000;
    vi.advanceTimersByTime(20);
    const frames = written.reduce((sum, data) => sum + data.numberOfFrames, 0);
    expect(frames).toBe(48_000);
    expect(written[1].timestamp).toBe(20_000);
    pump.stop();
  });
});
