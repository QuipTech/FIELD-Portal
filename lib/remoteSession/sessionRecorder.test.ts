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

let audioState = "running";

const setup = () => {
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("MediaStream", function (this: { tracks: unknown[] }, tracks: unknown[] = []) {
    this.tracks = tracks;
    Object.assign(this, { getVideoTracks: () => tracks.filter((t) => (t as { kind?: string }).kind === "video"), getAudioTracks: () => [] });
  });
  vi.stubGlobal("AudioContext", function () {
    return {
      state: audioState,
      onstatechange: null,
      resume: async () => undefined,
      createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [] } }),
      close: async () => undefined,
    };
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
  audioState = "running";
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

  it("draws frames from the visible video, and keeps the timeline going without one", () => {
    vi.useFakeTimers();
    setup();
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const createElement = document.createElement as unknown as { getMockImplementation: () => (name: string) => unknown };
    const original = createElement.getMockImplementation();
    vi.spyOn(document, "createElement").mockImplementation(((name: string) =>
      name === "canvas"
        ? { getContext: () => ({ drawImage, fillRect, fillStyle: "" }), captureStream: () => ({ getVideoTracks: () => [track("canvas")] }) }
        : original(name)) as never);
    let visible: HTMLVideoElement | null = null;
    const recorder = new SessionRecorder(vi.fn(), vi.fn(), undefined, () => visible);
    recorder.start(new MediaStream([track("tablet")] as never));
    vi.advanceTimersByTime(100);
    expect(drawImage).not.toHaveBeenCalled();
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1, 1);
    visible = { readyState: 4, videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement;
    vi.advanceTimersByTime(100);
    expect(drawImage).toHaveBeenCalledWith(visible, 0, 0, 1280, 720);
    vi.useRealTimers();
  });

  it("waits for a click to start sound, then records video only after 10 s", () => {
    vi.useFakeTimers();
    audioState = "suspended";
    setup();
    const waits: boolean[] = [];
    const states: boolean[] = [];
    const recorder = new SessionRecorder(vi.fn(), vi.fn(), (state) => states.push(state), undefined, (waiting) => waits.push(waiting));
    recorder.start(new MediaStream([track("tablet")] as never));
    expect(waits).toEqual([true]);
    expect(states).toEqual([]);
    vi.advanceTimersByTime(10_000);
    expect(waits).toEqual([true, false]);
    expect(states).toEqual([true]);
    vi.useRealTimers();
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
