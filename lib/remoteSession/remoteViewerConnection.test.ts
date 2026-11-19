import { afterEach, describe, expect, it, vi } from "vitest";
import type { RemoteSignalingConnection } from "../types/remoteSession";
import { encodeSignalingAction } from "./kvsSignaling";
import { RemoteViewerConnection } from "./remoteViewerConnection";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Portal viewer signaling", () => {
  it("replays the offer and ICE for a late tablet and stops after its answer", async () => {
    vi.useFakeTimers();
    const socket = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      onopen: () => {},
      onmessage: (_event: { data: string }) => {},
    };
    const offer = { type: "offer", sdp: "test offer" };
    const peer = {
      remoteDescription: null as unknown,
      createOffer: vi.fn().mockResolvedValue(offer),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      setRemoteDescription: vi.fn(async (answer: unknown) => { peer.remoteDescription = answer; }),
      addTransceiver: () => ({ sender: {} }),
      createDataChannel: () => ({ close: vi.fn() }),
      close: vi.fn(),
      onicecandidate: (_event: { candidate: { toJSON: () => object } }) => {},
    };
    vi.stubGlobal("WebSocket", Object.assign(function () { return socket; }, { OPEN: 1 }));
    vi.stubGlobal("RTCPeerConnection", function () { return peer; });
    vi.stubGlobal("MediaStream", function () { return { getTracks: () => [] }; });
    const access = { signalingUrl: "wss://signaling.test", iceServers: [] } as unknown as RemoteSignalingConnection;
    const viewer = new RemoteViewerConnection(access, {
      onState: vi.fn(), onStream: vi.fn(), onControlReady: vi.fn(),
    });
    viewer.start();
    peer.onicecandidate({ candidate: { toJSON: () => ({ candidate: "local ICE" }) } });
    socket.onopen();
    await vi.advanceTimersByTimeAsync(3000);
    expect(socket.send.mock.calls.map(([frame]) => JSON.parse(frame).action)).toEqual([
      "SDP_OFFER", "ICE_CANDIDATE", "SDP_OFFER", "ICE_CANDIDATE",
    ]);
    const answer = { type: "answer", sdp: "test answer" };
    const { messagePayload } = JSON.parse(encodeSignalingAction("SDP_ANSWER", answer));
    const frame = { data: JSON.stringify({ messageType: "SDP_ANSWER", messagePayload }) };
    socket.onmessage(frame);
    socket.onmessage(frame);
    await vi.advanceTimersByTimeAsync(9000);
    expect(peer.setRemoteDescription).toHaveBeenCalledTimes(1);
    expect(peer.setRemoteDescription).toHaveBeenCalledWith(answer);
    expect(socket.send).toHaveBeenCalledTimes(4);
    viewer.close();
  });
});
