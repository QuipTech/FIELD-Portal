import { describe, expect, it } from "vitest";
import { decodeSignalingMessage, encodeSignalingAction } from "./kvsSignaling";

describe("Kinesis signaling frames", () => {
  it("base64-encodes the JSON payload, with a recipient only when given", () => {
    const frame = JSON.parse(encodeSignalingAction("SDP_OFFER", { type: "offer", sdp: "v=0 é" }));
    expect(frame.action).toBe("SDP_OFFER");
    expect(frame.recipientClientId).toBeUndefined();
    expect(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(frame.messagePayload), (c) => c.charCodeAt(0))))).toEqual({
      type: "offer",
      sdp: "v=0 é",
    });
    expect(JSON.parse(encodeSignalingAction("SDP_ANSWER", {}, "viewer-1")).recipientClientId).toBe("viewer-1");
  });

  it("decodes what the other side sends, and ignores junk", () => {
    const answer = { type: "answer", sdp: "v=0" };
    const payload = btoa(JSON.stringify(answer));
    expect(decodeSignalingMessage(JSON.stringify({ messageType: "SDP_ANSWER", messagePayload: payload }))).toEqual({
      message: { messageType: "SDP_ANSWER", messagePayload: payload },
      payload: answer,
    });
    expect(decodeSignalingMessage("")).toBeNull();
    expect(decodeSignalingMessage("not json")).toBeNull();
  });
});
