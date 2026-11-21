import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionRecorder } from "./sessionRecorder";

class FakeRecorder {
  static last: FakeRecorder;
  state = "inactive";
  onstart: (() => void) | null = null;
  onstop: (() => void) | null = null;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  static isTypeSupported = () => true;
  constructor() {
    FakeRecorder.last = this;
  }
  start() {
    this.state = "recording";
    this.onstart?.();
  }
  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
}

const track = (id: string) => ({ id, kind: "video", getSettings: () => ({ width: 640, height: 360 }), stop: vi.fn() });

const setup = () => {
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("MediaStream", function (this: { tracks: unknown[] }, tracks: unknown[] = []) {
    this.tracks = tracks;
    Object.assign(this, { getVideoTracks: () => tracks.filter((t) => (t as { kind?: string }).kind === "video"), getAudioTracks: () => [] });
  });
  vi.stubGlobal("AudioContext", function () {
    return { createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }), close: async () => undefined };
  });
  const sources: { srcObject: unknown }[] = [];
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((name: string) => {
    if (name === "canvas") {
      return { getContext: () => null, captureStream: () => ({ getVideoTracks: () => [track("canvas")] }) } as never;
    }
    if (name === "video") {
      const video = { srcObject: null as unknown, play: async () => undefined, readyState: 0, videoWidth: 0 };
      sources.push(video);
      return video as never;
    }
    return createElement(name);
  });
  return sources;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("session recorder", () => {
  it("reports its real state and fails on an unexpected stop", () => {
    setup();
    const states: boolean[] = [];
    const failures: string[] = [];
    const recorder = new SessionRecorder(vi.fn(), (message) => failures.push(message), (state) => states.push(state));
    recorder.start(new MediaStream([track("tablet")] as never));
    FakeRecorder.last.stop();
    expect(states).toEqual([true, false]);
    expect(failures).toEqual(["Recording stopped unexpectedly."]);
  });

  it("records the new video track after a reconnect", () => {
    const sources = setup();
    const recorder = new SessionRecorder(vi.fn(), vi.fn());
    recorder.start(new MediaStream([track("first")] as never));
    const next = track("second");
    recorder.setVideo(next as never);
    expect((sources[0].srcObject as { tracks: unknown[] }).tracks).toEqual([next]);
  });

  it("does not report a failure when stopped on purpose", async () => {
    setup();
    const failures: string[] = [];
    const recorder = new SessionRecorder(vi.fn(), (message) => failures.push(message));
    recorder.start(new MediaStream([track("tablet")] as never));
    await recorder.stop();
    expect(failures).toEqual([]);
  });
});
